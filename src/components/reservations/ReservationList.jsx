import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dateFromMexicoDateKey, formatMexicoLongDateEs } from "@/lib/mexicoTime";
import { Calendar, Clock, Users, Mail, Phone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-blue-100 text-blue-800 border-blue-300",
  seated: "bg-green-100 text-green-800 border-green-300",
  completed: "bg-gray-100 text-gray-800 border-gray-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

export default function ReservationList({ reservations, isLoading, onUpdateStatus }) {
  if (isLoading) {
    return <div className="text-center py-12">Loading reservations...</div>;
  }

  if (reservations.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 text-lg">No reservations yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">All Reservations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="p-6 border rounded-xl hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold">{reservation.customer_name}</h3>
                    <Badge className={`${statusColors[reservation.status]} border`}>
                      {reservation.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatMexicoLongDateEs(
                        typeof reservation.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(reservation.date)
                          ? dateFromMexicoDateKey(reservation.date)
                          : reservation.date,
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {reservation.time}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {reservation.number_of_guests} guests
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {reservation.customer_email}
                    </div>
                    {reservation.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {reservation.customer_phone}
                      </div>
                    )}
                  </div>

                  {reservation.special_requests && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-900">
                        <strong>Special Requests:</strong> {reservation.special_requests}
                      </p>
                    </div>
                  )}
                </div>

                <div className="md:w-48">
                  <Select
                    value={reservation.status}
                    onValueChange={(value) => onUpdateStatus(reservation.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="seated">Seated</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}