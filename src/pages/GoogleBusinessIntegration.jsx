import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Building2, ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS_HUB = "/IntegrationsHub?hub=keys";

/**
 * Integrations hub: Google Business Profile API — list reviews, average rating, total count for a verified location.
 */
export default function GoogleBusinessIntegration() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-yellow-400" />
            <div>
              <h1 className="text-lg font-bold text-yellow-400">Google Business</h1>
              <p className="text-xs text-gray-500">
                Business Profile API — reviews, star ratings, and totals for your verified Google listing (Maps / Search).
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
              To read <strong className="text-white">all reviews and metrics</strong> for <strong className="text-white">Los Tíos</strong> (or any
              location you manage) on Google, use the official{" "}
              <strong className="text-white">Google Business Profile APIs</strong> with <strong className="text-white">OAuth 2.0</strong>. The reviews
              list method returns paginated reviews plus summary fields such as <code className="text-gray-400">averageRating</code> and{" "}
              <code className="text-gray-400">totalReviewCount</code> for the location.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-300">
            <ol className="list-decimal space-y-3 pl-5 marker:text-yellow-400">
              <li>
                Use a <strong className="text-white">Google Cloud project</strong> and enable the{" "}
                <strong className="text-white">Business Profile APIs</strong> (and related APIs as required by the current setup guide).
              </li>
              <li>
                Configure the <strong className="text-white">OAuth consent screen</strong> and add OAuth client credentials (web app for this SPA + secure
                backend for refresh tokens).
              </li>
              <li>
                Request an OAuth scope that allows Business Profile access, for example{" "}
                <code className="rounded bg-black/40 px-1 text-gray-400">https://www.googleapis.com/auth/business.manage</code> (see Google&apos;s latest
                list; some docs also reference <code className="text-gray-400">plus.business.manage</code>).
              </li>
              <li>
                Sign in with a Google account that <strong className="text-white">owns or manages</strong> the Business Profile for the restaurant. The
                listing must be <strong className="text-white">verified</strong>; unverified locations may not return review data.
              </li>
              <li>
                Discover <code className="text-gray-400">accountId</code> and <code className="text-gray-400">locationId</code> via the Accounts and
                Locations APIs, then call{" "}
                <strong className="text-white">accounts.locations.reviews.list</strong> on{" "}
                <code className="text-gray-400">mybusiness.googleapis.com</code> (v4 REST path shape:{" "}
                <code className="text-gray-400">GET .../v4/accounts/&#123;accountId&#125;/locations/&#123;locationId&#125;/reviews</code>
                ). Use <code className="text-gray-400">pageSize</code> (up to 50) and <code className="text-gray-400">pageToken</code> until all pages are
                read.
              </li>
              <li>
                Store <strong className="text-white">refresh tokens</strong> only on a trusted server; schedule periodic sync to your dashboard for
                review count and average rating trends.
              </li>
            </ol>

            <p className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-3 text-xs text-emerald-100/90">
              <strong className="text-emerald-200">Why this fits your goal:</strong> Unlike public scraping, this API is the supported way to obtain
              structured review lists and aggregates for a profile you manage — ideal for tracking total reviews and scores for Puerto Escondido in one
              place.
            </p>

            <p className="rounded-xl border border-sky-500/20 bg-sky-950/30 p-3 text-xs text-sky-100/90">
              <strong className="text-sky-200">Status:</strong> requirements only — OAuth token storage and scheduled sync are not implemented in this app
              yet; use this checklist when you or your developer connect the backend.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5">
                <Link to={KEYS_HUB}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  API Keys (other integrations)
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a
                  href="https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list"
                  target="_blank"
                  rel="noreferrer"
                >
                  Reviews.list (REST)
                  <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.google.com/my-business/content/implement-oauth" target="_blank" rel="noreferrer">
                  OAuth for Business Profile
                  <BookOpen className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.google.com/my-business/content/review-data" target="_blank" rel="noreferrer">
                  Work with review data
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
