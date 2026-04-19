import { Link } from "react-router-dom";
import { ExternalLink, KeyRound, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS_HUB = "/IntegrationsHub?hub=keys";

/**
 * Integrations hub: Tripadvisor Content API — ratings, review counts, sample reviews for a location.
 */
export default function TripAdvisorIntegration() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-yellow-400" />
            <div>
              <h1 className="text-lg font-bold text-yellow-400">Tripadvisor</h1>
              <p className="text-xs text-gray-500">
                Content API — location rating, review breakdowns, and recent reviews for your listing (e.g. Los Tíos in Puerto Escondido).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] space-y-6 px-3 py-6 sm:px-5 lg:px-6">
        <Card className="border-white/10 bg-[#242424] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-yellow-200">What you need (English)</CardTitle>
            <p className="text-sm text-gray-400">
              Tripadvisor exposes POI data through the official <strong className="text-white">Tripadvisor Content API</strong> (
              <code className="text-gray-400">api.content.tripadvisor.com</code>). You can retrieve{" "}
              <strong className="text-white">aggregate rating</strong>, <strong className="text-white">review counts by star level</strong>, and other
              business fields for a known <strong className="text-white">location ID</strong>. Review text endpoints typically return a{" "}
              <strong className="text-white">limited number of recent reviews</strong> per call (see current Tripadvisor docs for exact limits).
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-300">
            <ol className="list-decimal space-y-3 pl-5 marker:text-yellow-400">
              <li>
                Register in the{" "}
                <a
                  href="https://developer-tripadvisor.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 underline underline-offset-2"
                >
                  Tripadvisor developer portal
                </a>{" "}
                and subscribe to the Content API. Commercial use is usually <strong className="text-white">pay-as-you-go</strong> with a monthly free
                allowance; you set billing and usage caps in the developer console.
              </li>
              <li>
                Create an <strong className="text-white">API key</strong> and restrict it (HTTP referrer / IP) where possible.
              </li>
              <li>
                Find your restaurant&apos;s <strong className="text-white">location ID</strong>: use the API&apos;s{" "}
                <strong className="text-white">location search</strong> (e.g. query &quot;Los Tíos&quot; near Puerto Escondido coordinates) and confirm the
                result matches your official listing.
              </li>
              <li>
                Call <strong className="text-white">location details</strong> to read overall rating and fields such as{" "}
                <code className="text-gray-400">review_rating_count</code> (counts per star) and related breakdowns as documented.
              </li>
              <li>
                Use <strong className="text-white">location reviews</strong> for the most recent review snippets; paginate or poll on a schedule that
                respects Tripadvisor rate limits and your subscription tier.
              </li>
            </ol>

            <p className="rounded-xl border border-amber-500/25 bg-amber-950/40 p-3 text-xs text-amber-100/90">
              <strong className="text-amber-200">Limits:</strong> The Content API is designed for partner use of Tripadvisor content, not for scraping the
              public website. &quot;All reviews ever&quot; in one dump is usually <strong className="text-white">not</strong> available; plan dashboards
              around aggregates plus recent samples, or export tools Tripadvisor provides to business owners where applicable.
            </p>

            <p className="rounded-xl border border-sky-500/20 bg-sky-950/30 p-3 text-xs text-sky-100/90">
              <strong className="text-sky-200">Status:</strong> this screen is the requirements checklist. Storing the API key and scheduled sync jobs in
              this app can be added in a follow-up once you have a Content API subscription.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5">
                <Link to={KEYS_HUB}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  API Keys (other integrations)
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developer-tripadvisor.com/content-api" target="_blank" rel="noreferrer">
                  Tripadvisor Content API
                  <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://tripadvisor-content-api.readme.io/reference/overview" target="_blank" rel="noreferrer">
                  API reference (Readme)
                  <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
