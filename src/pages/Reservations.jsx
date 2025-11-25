import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus } from "lucide-react";

import ReservationList from "../components/reservations/ReservationList";
import ReservationForm from "../components/reservations/ReservationForm";

export default function Reservations() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => base44.entities.Reservation.list('-date'),
  });

  const createReservation = useMutation({
    mutationFn: (data) => base44.entities.Reservation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setShowForm(false);
    },
  });

  const updateReservation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reservation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayReservations = reservations.filter(r => {
    const reservationDate = new Date(r.date);
    reservationDate.setHours(0, 0, 0, 0);
    return reservationDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
  });

  const upcomingReservations = reservations.filter(r => {
    const reservationDate = new Date(r.date);
    reservationDate.setHours(0, 0, 0, 0);
    return reservationDate.getTime() > today.getTime();
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Reservations</h1>
                <p className="text-gray-600 mt-1">Manage table bookings</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              New Reservation
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Today's Reservations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{todayReservations.length}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{upcomingReservations.length}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{reservations.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Reservation Form */}
        {showForm && (
          <ReservationForm
            onSubmit={(data) => createReservation.mutate(data)}
            onCancel={() => setShowForm(false)}
            isLoading={createReservation.isPending}
          />
        )}

        {/* Reservation List */}
        <ReservationList
          reservations={reservations}
          isLoading={isLoading}
          onUpdateStatus={(id, status) => updateReservation.mutate({ id, data: { status } })}
        />
      </div>
    </div>
  );
}