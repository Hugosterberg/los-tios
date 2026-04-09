import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, CreditCard, Store } from "lucide-react";
import Integrations from "./Integrations";
import Clip from "./Clip";
import Loyverse from "./Loyverse";

export default function IntegrationsHub() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-3 text-lg font-bold text-yellow-400">Integrations</h1>
          <Tabs defaultValue="keys">
            <TabsList className="h-auto gap-1 bg-transparent p-0">
              <TabsTrigger
                value="keys"
                className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-yellow-500/20 bg-[#242424] px-4 py-2 text-xs text-gray-400 data-[state=active]:border-yellow-400/40 data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300"
              >
                <KeyRound className="h-3.5 w-3.5" />
                API Keys
              </TabsTrigger>
              <TabsTrigger
                value="clip"
                className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-yellow-500/20 bg-[#242424] px-4 py-2 text-xs text-gray-400 data-[state=active]:border-yellow-400/40 data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Clip
              </TabsTrigger>
              <TabsTrigger
                value="loyverse"
                className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-yellow-500/20 bg-[#242424] px-4 py-2 text-xs text-gray-400 data-[state=active]:border-yellow-400/40 data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300"
              >
                <Store className="h-3.5 w-3.5" />
                Loyverse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="keys" className="mt-0">
              <Integrations />
            </TabsContent>
            <TabsContent value="clip" className="mt-0">
              <Clip />
            </TabsContent>
            <TabsContent value="loyverse" className="mt-0">
              <Loyverse />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}