
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, EyeOff, Clock, Leaf } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function MenuItemCard({ item, onEdit, onDelete, onToggleAvailability }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      <Card className={`overflow-hidden border-2 transition-all ${
        item.is_available ? 'border-gray-200 hover:border-red-300' : 'border-gray-300 opacity-60'
      }`}>
        <div className="relative h-48 overflow-hidden group">
          <img
            src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {!item.is_available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="destructive" className="text-lg px-4 py-2">
                Unavailable
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{item.name}</h3>
              {item.name_en && (
                <p className="text-sm text-gray-600 italic">{item.name_en}</p>
              )}
            </div>
            <span className="text-xl font-bold text-red-600 ml-2">${item.price?.toFixed(2)}</span>
          </div>

          {item.description && (
            <p className="text-gray-600 text-sm mb-1 line-clamp-2">{item.description}</p>
          )}
          {item.description_en && (
            <p className="text-gray-500 text-xs mb-3 line-clamp-2 italic">{item.description_en}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className="text-xs">
              {item.category?.replace(/_/g, ' ')}
            </Badge>
            {item.is_vegetarian && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                <Leaf className="w-3 h-3 mr-1" />
                Vegetarian
              </Badge>
            )}
            {item.preparation_time && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {item.preparation_time} min
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Switch
                checked={item.is_available}
                onCheckedChange={(checked) => onToggleAvailability(item.id, checked)}
              />
              <span className="text-sm text-gray-600">Available</span>
            </div>

            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => onEdit(item)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
