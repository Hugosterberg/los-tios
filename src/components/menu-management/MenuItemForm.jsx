import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

export default function MenuItemForm({ item, onSubmit, onCancel, isLoading }) {
  const canUploadImages = Boolean(appParams.appId && appParams.serverUrl && appParams.token);
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    description_en: "",
    category: "mains",
    price: 0,
    image_url: "",
    ingredients: [],
    is_vegetarian: false,
    is_available: true,
    preparation_time: 15,
  });

  const [ingredientInput, setIngredientInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const addIngredient = () => {
    if (!ingredientInput.trim()) return;
    setFormData({ ...formData, ingredients: [...(formData.ingredients || []), ingredientInput.trim()] });
    setIngredientInput("");
  };

  const removeIngredient = (index) => {
    setFormData({ ...formData, ingredients: formData.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index) });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!canUploadImages) {
      alert("Image upload requires a real Base44 backend and login. Use the image URL field locally.");
      return;
    }

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: file_url });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("The image could not be uploaded. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="mb-6 bg-[#242424] border border-yellow-500/20 rounded-xl p-5">
      <h2 className="text-sm font-bold text-yellow-400 mb-4">{item ? "Edit Item" : "Add New Item"}</h2>
      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name (Primary) *</Label>
              <Input id="name" required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="e.g. Truffle Risotto" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_en">Item Name (English)</Label>
              <Input id="name_en" value={formData.name_en} onChange={(event) => setFormData({ ...formData, name_en: event.target.value })} placeholder="e.g. Truffle Risotto" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price ($) *</Label>
              <Input id="price" type="number" step="0.01" min="0" required value={formData.price} onChange={(event) => setFormData({ ...formData, price: parseFloat(event.target.value) })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appetizers">Appetizers</SelectItem>
                  <SelectItem value="pizzas">Pizzas</SelectItem>
                  <SelectItem value="paninis">Paninis</SelectItem>
                  <SelectItem value="desserts">Desserts</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                  <SelectItem value="salsas">Sauces</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prep_time">Preparation Time (minutes)</Label>
              <Input id="prep_time" type="number" min="0" value={formData.preparation_time} onChange={(event) => setFormData({ ...formData, preparation_time: parseInt(event.target.value, 10) })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-colors ${canUploadImages ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-60"}`}>
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">{uploadingImage ? "Uploading..." : "Upload image"}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage || !canUploadImages} className="hidden" />
                  </label>
                </div>
                {!canUploadImages && (
                  <p className="text-xs text-amber-400">
                    File upload is not available in local bypass without Base44 configuration and a token. Paste an image URL or sign in against the real backend.
                  </p>
                )}
                {formData.image_url && (
                  <div className="relative">
                    <img src={formData.image_url} alt="Preview" className="w-full h-48 object-cover rounded-lg border" />
                    <button type="button" onClick={() => setFormData({ ...formData, image_url: "" })} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <Label className="text-xs text-gray-500">Or paste an image URL</Label>
                  <Input id="image" value={formData.image_url} onChange={(event) => setFormData({ ...formData, image_url: event.target.value })} placeholder="https://example.com/image.jpg" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Primary)</Label>
            <Textarea id="description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Describe the dish..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_en">Description (English)</Label>
            <Textarea id="description_en" value={formData.description_en} onChange={(event) => setFormData({ ...formData, description_en: event.target.value })} placeholder="Describe the dish in English..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients</Label>
            <div className="flex gap-2">
              <Input
                id="ingredients"
                value={ingredientInput}
                onChange={(event) => setIngredientInput(event.target.value)}
                placeholder="Add an ingredient..."
                onKeyPress={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addIngredient();
                  }
                }}
              />
              <Button type="button" onClick={addIngredient} variant="outline">
                Add
              </Button>
            </div>
            {formData.ingredients?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.ingredients.map((ingredient, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {ingredient}
                    <button type="button" onClick={() => removeIngredient(index)} className="ml-1 hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_vegetarian} onCheckedChange={(checked) => setFormData({ ...formData, is_vegetarian: checked })} />
              <Label>Vegetarian</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formData.is_available} onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })} />
              <Label>Available</Label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onCancel} className="h-8 text-xs border-yellow-500/20 text-gray-400 hover:text-gray-200 bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="h-8 text-xs bg-yellow-400 hover:bg-yellow-300 text-black">
              {isLoading ? "Saving..." : item ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
