
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Save, RefreshCw, Image as ImageIcon, CreditCard, Banknote } from "lucide-react"; // Added CreditCard and Banknote
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { appParams } from "@/lib/app-params";
import { saveStoredIntegrationSettings } from "@/lib/integrationSettings";
import { buildDefaultAppSettings } from "@/lib/appSettings";
import { createPageUrl } from "@/utils";

export default function Customization() {
  const queryClient = useQueryClient();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const canUploadImages = Boolean(appParams.appId && appParams.serverUrl && appParams.token);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const currentSettings = buildDefaultAppSettings(settings[0] || {});

  const [formData, setFormData] = useState(currentSettings);

  React.useEffect(() => {
    if (settings[0]) {
      const mergedSettings = buildDefaultAppSettings(settings[0]);
      setFormData(mergedSettings);
      saveStoredIntegrationSettings(mergedSettings);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (data) => {
      if (settings[0]) {
        return base44.entities.AppSettings.update(settings[0].id, data);
      } else {
        return base44.entities.AppSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      saveStoredIntegrationSettings(formData);
      alert("Settings saved successfully.");
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canUploadImages) {
      alert("Image upload requires a configured backend and sign-in. Use the image URL field locally.");
      return;
    }

    setUploadingLogo(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: result.file_url });
    } catch (error) {
      alert('Error uploading logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveSettings.mutate(formData);
  };

  const resetToDefaults = () => {
    if (confirm("Are you sure you want to reset to defaults?")) {
      setFormData(buildDefaultAppSettings());
    }
  };

  const presetThemes = [
    {
      name: "Classic Red",
      primary: "#DC2626",
      secondary: "#F97316",
      accent: "#10B981",
      style: "classic"
    },
    {
      name: "Elegant Blue",
      primary: "#2563EB",
      secondary: "#7C3AED",
      accent: "#10B981",
      style: "elegant"
    },
    {
      name: "Fresh Green",
      primary: "#059669",
      secondary: "#10B981",
      accent: "#F59E0B",
      style: "modern"
    },
    {
      name: "Vibrant Orange",
      primary: "#EA580C",
      secondary: "#F97316",
      accent: "#8B5CF6",
      style: "playful"
    },
  ];

  const applyPreset = (preset) => {
    setFormData({
      ...formData,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      accent_color: preset.accent,
      theme_style: preset.style,
    });
  };

  const logoPresets = [
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop", // Pizza
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop", // Pizza slice
    "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=200&h=200&fit=crop", // Chef hat
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop", // Burger
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Palette className="w-10 h-10" />
              <h1 className="text-4xl font-bold">Customization</h1>
            </div>
            <p className="text-purple-100">Customize your restaurant's appearance</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Preview Card */}
          <Card className="border-0 shadow-xl overflow-hidden">
            <div
              className="h-32"
              style={{
                background: `linear-gradient(135deg, ${formData.primary_color} 0%, ${formData.secondary_color} 100%)`
              }}
            ></div>
            <CardContent className="p-8 -mt-16">
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: formData.primary_color }}
                  >
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {formData.restaurant_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold" style={{ color: formData.text_color }}>
                      {formData.restaurant_name}
                    </h2>
                    <p className="text-gray-500">Preview</p>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <div
                    className="flex-1 h-12 rounded-lg"
                    style={{ backgroundColor: formData.primary_color }}
                  ></div>
                  <div
                    className="flex-1 h-12 rounded-lg"
                    style={{ backgroundColor: formData.secondary_color }}
                  ></div>
                  <div
                    className="flex-1 h-12 rounded-lg"
                    style={{ backgroundColor: formData.accent_color }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Restaurant Info */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Restaurant Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name</Label>
                  <Input
                    id="name"
                    value={formData.restaurant_name}
                    onChange={(e) => setFormData({ ...formData, restaurant_name: e.target.value })}
                    placeholder="Los Tios"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="+52 55 1234 5678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@lostios.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Calle Principal 123, Col. Centro"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logo Settings */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Restaurant Logo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Logo</Label>
                  <div className="border-2 border-dashed rounded-xl p-8 text-center">
                    {formData.logo_url ? (
                      <img
                        src={formData.logo_url}
                        alt="Logo"
                        className="w-32 h-32 object-cover rounded-lg mx-auto"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-200 rounded-lg mx-auto flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo-upload">Upload Custom Logo</Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo || !canUploadImages}
                  />
                  {uploadingLogo && (
                    <p className="text-sm text-gray-500">Uploading...</p>
                  )}
                  {!canUploadImages && (
                    <p className="text-sm text-amber-600">
                      File upload requires a configured backend and token. Use an image URL locally or sign in to the real environment.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Or Use Image URL</Label>
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Preset Logos</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {logoPresets.map((url, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setFormData({ ...formData, logo_url: url })}
                        className="border-2 rounded-lg p-2 hover:border-red-500 transition-colors"
                      >
                        <img src={url} alt={`Preset ${index + 1}`} className="w-full h-16 object-cover rounded" />
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Theme Presets */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Preset Themes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {presetThemes.map((preset, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="border-2 rounded-xl p-4 hover:border-purple-500 transition-colors text-left"
                  >
                    <div className="flex gap-2 mb-3">
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: preset.primary }}></div>
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: preset.secondary }}></div>
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: preset.accent }}></div>
                    </div>
                    <p className="font-semibold text-sm">{preset.name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Color Settings */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Custom Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="primary">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary"
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="h-12 w-20"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      placeholder="#DC2626"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondary">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary"
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="h-12 w-20"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      placeholder="#F97316"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accent">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent"
                      type="color"
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      className="h-12 w-20"
                    />
                    <Input
                      value={formData.accent_color}
                      onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                      placeholder="#10B981"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="text"
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="h-12 w-20"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      placeholder="#111827"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background"
                      type="color"
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      className="h-12 w-20"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                      placeholder="#F9FAFB"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme-style">Theme Style</Label>
                  <Select
                    value={formData.theme_style}
                    onValueChange={(value) => setFormData({ ...formData, theme_style: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="elegant">Elegant</SelectItem>
                      <SelectItem value="playful">Playful</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Settings */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Accepted Payment Methods</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <input
                      type="checkbox"
                      id="accept_cash"
                      checked={formData.accept_cash}
                      onChange={(e) => setFormData({ ...formData, accept_cash: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <Label htmlFor="accept_cash" className="flex items-center gap-2 cursor-pointer">
                      <Banknote className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-semibold">Cash</p>
                        <p className="text-xs text-gray-500">Payment on delivery</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <input
                      type="checkbox"
                      id="accept_card"
                      checked={formData.accept_card}
                      onChange={(e) => setFormData({ ...formData, accept_card: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <Label htmlFor="accept_card" className="flex items-center gap-2 cursor-pointer">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-semibold">Card</p>
                        <p className="text-xs text-gray-500">Bank transfer</p>
                      </div>
                    </Label>
                  </div>
                </div>
              </div>

              {formData.accept_card && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900">Bank Information</h4>
                  <p className="text-sm text-blue-700">This information is shown on the receipt when the customer selects card payment.</p>

                  <div className="space-y-2">
                    <Label htmlFor="clip_payment_link">Clip payment link</Label>
                    <Input
                      id="clip_payment_link"
                      value={formData.clip_payment_link || ""}
                      onChange={(e) => setFormData({ ...formData, clip_payment_link: e.target.value })}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-blue-700">
                      This link opens when the customer chooses card payment at checkout.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input
                        id="bank_name"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="BBVA Bancomer"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account_holder">Account Holder</Label>
                      <Input
                        id="account_holder"
                        value={formData.bank_account_holder}
                        onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                        placeholder="Pizzeria Los Tios S.A."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account_number">Account Number</Label>
                      <Input
                        id="account_number"
                        value={formData.bank_account_number}
                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clabe">CLABE Interbancaria</Label>
                      <Input
                        id="clabe"
                        value={formData.clabe}
                        onChange={(e) => setFormData({ ...formData, clabe: e.target.value })}
                        placeholder="012180001234567890"
                        maxLength={18}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Keys and secrets now live in a dedicated admin screen so they do not get mixed into visual customization.
              </p>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                <p className="font-semibold text-purple-950">Open the Integrations page</p>
                <p className="mt-1 text-sm text-purple-800">
                  There you can update all Clip and Loyverse public and secret keys from one place.
                </p>
                <Button
                  type="button"
                  className="mt-4 bg-purple-600 hover:bg-purple-700"
                  onClick={() => window.location.assign(createPageUrl("Integrations"))}
                >
                  Go to Integrations
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={resetToDefaults}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              type="submit"
              disabled={saveSettings.isPending}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {saveSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
