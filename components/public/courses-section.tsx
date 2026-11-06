/**
 * Public courses / LMS catalog section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <CoursesSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via service role; renders
 * nothing when there are no active courses.)
 */
import { listPublicCourses } from "@/lib/services/courses.service";
import { inkOn } from "@/lib/storefront-brand";

export async function CoursesSection({
  businessId,
  brand,
  contactEnabled = true,
}: {
  businessId: string;
  brand: string;
  contactEnabled?: boolean;
}) {
  const courses = await listPublicCourses(businessId);
  if (courses.length === 0) return null;

  return (
    <section id="courses" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-3xl font-bold">הקורסים שלנו</h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            >
              {course.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.image_url}
                  alt={course.title}
                  loading="lazy"
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div
                  className="h-44 w-full"
                  style={{ backgroundColor: `${brand}1a` }}
                />
              )}

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-zinc-900">{course.title}</h3>

                {(course.level || course.duration) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {course.level && (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${brand}1a`, color: brand }}
                      >
                        {course.level}
                      </span>
                    )}
                    {course.duration && (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${brand}1a`, color: brand }}
                      >
                        {course.duration}
                      </span>
                    )}
                  </div>
                )}

                {course.description && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {course.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  {course.price != null ? (
                    <span className="text-lg font-bold" style={{ color: brand }}>
                      ₪{Number(course.price).toLocaleString("he-IL")}
                    </span>
                  ) : (
                    <span />
                  )}
                  {contactEnabled && (
                    <a
                      href="#contact"
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brand, color: inkOn(brand) }}
                    >
                      להרשמה
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
