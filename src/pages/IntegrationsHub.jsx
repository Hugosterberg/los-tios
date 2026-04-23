// @ts-nocheck
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, CreditCard, Store, Wallet, StickyNote, Mail, Cloud, MapPin, Building2 } from "lucide-react";
import Integrations from "./Integrations";
import Clip from "./Clip";
import Loyverse from "./Loyverse";
import Revolut from "./Revolut";
import NotionIntegration from "./NotionIntegration";
import GmailIntegration from "./GmailIntegration";
import GoogleDriveIntegration from "./GoogleDriveIntegration";
import TripAdvisorIntegration from "./TripAdvisorIntegration";
import GoogleBusinessIntegration from "./GoogleBusinessIntegration";

const HUB_TABS = [
  "clip",
  "loyverse",
  "revolut",
  "notion",
  "gmail",
  "googledrive",
  "tripadvisor",
  "googlebusiness",
  "keys",
];

const tabTriggerClass =
  "flex items-center gap-1.5 rounded-t-lg border border-b-0 border-yellow-500/20 bg-[#242424] px-3 py-2 text-xs text-gray-400 data-[state=active]:border-yellow-400/40 data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 sm:px-4";

export default function IntegrationsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hubParam = searchParams.get("hub");
  const activeHub = HUB_TABS.includes(hubParam) ? hubParam : "clip";

  const onHubChange = (value) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("hub", value);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-3 text-lg font-bold text-yellow-400">Integrations</h1>
          <Tabs value={activeHub} onValueChange={onHubChange}>
            <TabsList className="h-auto w-full flex-wrap gap-1 bg-transparent p-0">
              <TabsTrigger value="clip" className={tabTriggerClass}>
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                Clip
              </TabsTrigger>
              <TabsTrigger value="loyverse" className={tabTriggerClass}>
                <Store className="h-3.5 w-3.5 shrink-0" />
                Loyverse
              </TabsTrigger>
              <TabsTrigger value="revolut" className={tabTriggerClass}>
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                Revolut
              </TabsTrigger>
              <TabsTrigger value="notion" className={tabTriggerClass}>
                <StickyNote className="h-3.5 w-3.5 shrink-0" />
                Notion
              </TabsTrigger>
              <TabsTrigger value="gmail" className={tabTriggerClass}>
                <Mail className="h-3.5 w-3.5 shrink-0" />
                Gmail
              </TabsTrigger>
              <TabsTrigger value="googledrive" className={tabTriggerClass}>
                <Cloud className="h-3.5 w-3.5 shrink-0" />
                Google Drive
              </TabsTrigger>
              <TabsTrigger value="tripadvisor" className={tabTriggerClass}>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                Tripadvisor
              </TabsTrigger>
              <TabsTrigger value="googlebusiness" className={tabTriggerClass}>
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                Google Business
              </TabsTrigger>
              <TabsTrigger value="keys" className={tabTriggerClass}>
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                API Keys
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clip" className="mt-0">
              <Clip />
            </TabsContent>
            <TabsContent value="loyverse" className="mt-0">
              <Loyverse />
            </TabsContent>
            <TabsContent value="revolut" className="mt-0">
              <Revolut />
            </TabsContent>
            <TabsContent value="notion" className="mt-0">
              <NotionIntegration />
            </TabsContent>
            <TabsContent value="gmail" className="mt-0">
              <GmailIntegration />
            </TabsContent>
            <TabsContent value="googledrive" className="mt-0">
              <GoogleDriveIntegration />
            </TabsContent>
            <TabsContent value="tripadvisor" className="mt-0">
              <TripAdvisorIntegration />
            </TabsContent>
            <TabsContent value="googlebusiness" className="mt-0">
              <GoogleBusinessIntegration />
            </TabsContent>
            <TabsContent value="keys" className="mt-0">
              <Integrations />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
