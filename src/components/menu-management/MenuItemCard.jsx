// @ts-nocheck
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Clock, Leaf } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function MenuItemCard({ item, onEdit, onDelete, onToggleAvailability }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      <div className={`bg-[#242424] border rounded-xl overflow-hidden transition-all flex flex-col h-full ${
        item.is_available ? 'border-yellow-500/20 hover:border-yellow-500/40' : 'border-gray-700/30 opacity-50'
      }`}>
        <div className="relative h-40 overflow-hidden">
          <img
            src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {!item.is_available && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">No disponible</span>
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <h3 className="font-bold text-sm text-white">{item.name}</h3>
              {item.name_en && (
                <p className="text-xs text-gray-500 italic">{item.name_en}</p>
              )}
            </div>
            <span className="text-base font-bold text-yellow-400 ml-2">${item.price?.toFixed(0)}</span>
          </div>

          {item.description && (
            <p className="text-gray-500 text-xs mb-2 line-clamp-2">{item.description}</p>
          )}

          <div className="flex flex-wrap gap-1 mb-3 flex-1 content-start">
            <Badge className="text-xs bg-yellow-400/10 text-yellow-400 border-0">
              {item.category?.replace(/_/g, ' ')}
            </Badge>
            {item.is_vegetarian && (
              <Badge className="bg-green-900/30 text-green-400 border-0 text-xs">
                <Leaf className="w-2.5 h-2.5 mr-1" />
                Vegetariano
              </Badge>
            )}
            {item.preparation_time && (
              <Badge className="bg-gray-700/50 text-gray-400 border-0 text-xs">
                <Clock className="w-2.5 h-2.5 mr-1" />
                {item.preparation_time} min
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-yellow-500/10">
            <div className="flex items-center gap-2">
              <Switch
                checked={item.is_available}
                onCheckedChange={(checked) => onToggleAvailability(item.id, checked)}
                className="scale-75"
              />
              <span className="text-xs text-gray-600">Disponible</span>
            </div>

            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEdit(item)}
                className="h-7 w-7 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10"
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-red-400/10"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}