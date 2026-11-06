import { notFound, redirect } from "next/navigation";

import { getBusiness } from "@/lib/services/business.service";
import {
  listLeads,
  listCustomers,
  listTasks,
  listDeals,
  getCrmFocus,
} from "@/lib/services/crm.service";
import { listUpcomingBookings } from "@/lib/services/booking.service";
import { listOrders, listOrderItemsByOrder } from "@/lib/services/orders.service";
import { listInvoices, listRefundsByOrder } from "@/lib/services/store-payments.service";
import { listExternalInvoicesByOrder } from "@/lib/services/invoicing";
import { getStoreSalesStats, getCustomerSegments } from "@/lib/services/store-analytics.service";
import { listAbandonedCarts } from "@/lib/services/abandoned-cart.service";
import { listReturns } from "@/lib/services/returns.service";
import {
  getWhatsappConversations,
  getMessagesByConversation,
} from "@/lib/services/whatsapp.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { modeAllowsNav } from "@/lib/site-mode";
import { CrmDashboard } from "@/components/business/crm-dashboard";
import { OrdersManager } from "@/components/business/orders-manager";
import { StoreSalesCard } from "@/components/business/store-sales-card";
import { AbandonedCarts } from "@/components/business/abandoned-carts";
import { AiStoreInsights } from "@/components/business/ai-store-insights";
import { CustomerSegments } from "@/components/business/customer-segments";
import { ReturnsManager } from "@/components/business/returns-manager";
import { WhatsappFollowUps } from "@/components/business/whatsapp-follow-ups";

export const metadata = { title: "לקוחות ומכירות" };

/**
 * The single customer-facing desk: leads, customers, tasks, deals, the WhatsApp
 * follow-up queue, orders and returns.
 *
 * Orders and returns used to be their own nav entries. That split one person
 * across three screens — somebody who buys, asks a question on WhatsApp, then
 * wants to return the item was three unrelated rows in three places, and the
 * owner had to remember to check all of them. Everything a customer does now
 * lands in one screen, and each part still loads only when the plan and the
 * site mode actually include it.
 */
export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { businessId } = await params;
  const { tab } = await searchParams;
  // "תזמון לילות" moved to the חנות screen — a night is something the business
  // sells, not a customer record. Old bookmarks and links land there.
  if (tab === "rentals") redirect(`/businesses/${businessId}/store`);
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const [leads, customers, tasks, deals, bookings, plan, focus] = await Promise.all([
    listLeads(businessId),
    listCustomers(businessId),
    listTasks(businessId),
    listDeals(businessId),
    listUpcomingBookings(businessId),
    getPlanForBusiness(businessId),
    getCrmFocus(businessId),
  ]);

  // Orders + returns exist only where there is something to sell, so a landing
  // page or a brochure site never pays for these queries at all.
  let orders: React.ReactNode = null;
  let returns: React.ReactNode = null;
  if (modeAllowsNav(business.site_mode, "orders")) {
    const [
      orderRows,
      itemsByOrder,
      invoices,
      refundsByOrder,
      salesStats,
      abandonedCarts,
      externalInvoiceByOrder,
      segments,
    ] = await Promise.all([
      listOrders(businessId),
      listOrderItemsByOrder(businessId),
      listInvoices(businessId),
      listRefundsByOrder(businessId),
      getStoreSalesStats(businessId),
      listAbandonedCarts(businessId),
      listExternalInvoicesByOrder(businessId),
      getCustomerSegments(businessId),
    ]);
    const invoiceByOrder: Record<string, string> = {};
    for (const inv of invoices) invoiceByOrder[inv.order_id] = inv.id;

    orders = (
      <div className="flex flex-col gap-6">
        <StoreSalesCard stats={salesStats} />
        <CustomerSegments customers={segments} />
        <AiStoreInsights businessId={businessId} />
        {abandonedCarts.length > 0 && (
          <AbandonedCarts businessId={businessId} carts={abandonedCarts} />
        )}
        <OrdersManager
          businessId={businessId}
          orders={orderRows}
          itemsByOrder={itemsByOrder}
          invoiceByOrder={invoiceByOrder}
          refundsByOrder={refundsByOrder}
          externalInvoiceByOrder={externalInvoiceByOrder}
        />
      </div>
    );
  }
  if (modeAllowsNav(business.site_mode, "returns")) {
    returns = <ReturnsManager businessId={businessId} returns={await listReturns(businessId)} />;
  }

  // The follow-up queue only makes sense once the WhatsApp agent is included.
  let followUps: React.ReactNode = null;
  let pendingReplies = 0;
  if (planAllows(plan, "whatsapp_agent")) {
    const conversations = await getWhatsappConversations(businessId);
    const openConversationIds = conversations.filter((c) => c.needs_reply).map((c) => c.id);
    const messagesByConversation = await getMessagesByConversation(businessId, openConversationIds);
    pendingReplies = openConversationIds.length;
    followUps = (
      <WhatsappFollowUps
        businessId={businessId}
        conversations={conversations}
        messagesByConversation={messagesByConversation}
      />
    );
  }

  return (
    <CrmDashboard
      businessId={businessId}
      leads={leads}
      customers={customers}
      tasks={tasks}
      deals={deals}
      upcomingBookings={bookings.filter((b) => b.status !== "cancelled").length}
      orders={orders}
      returns={returns}
      followUps={followUps}
      pendingReplies={pendingReplies}
      defaultTab={tab}
      focus={focus}
      siteMode={business.site_mode}
    />
  );
}
