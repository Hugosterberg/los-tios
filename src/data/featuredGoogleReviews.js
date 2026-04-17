/**
 * Utvalda 5-stjärniga recensioner att visa på webben.
 * Byt ut författare och text mot exakt citat från Google Business
 * (Google Maps → er profil → Recensioner / Reviews).
 *
 * Källa: https://maps.app.goo.gl/L2BSM4MaUvnUF6TK9
 *
 * @typedef {{ id: string; author: string; textEs: string; textEn: string }} FeaturedGoogleReview
 */

/** @type {readonly FeaturedGoogleReview[]} */
export const FEATURED_GOOGLE_REVIEWS = [
  {
    id: "1",
    author: "María G.",
    textEs:
      "La pizza está buenísima, masa liviana y bordes dorados. El ambiente en el centro es súper agradable y el pedido por WhatsApp fue rapidísimo.",
    textEn:
      "The pizza is excellent, light crust and golden edges. Great vibe downtown and WhatsApp ordering was really fast.",
  },
  {
    id: "2",
    author: "Carlos T.",
    textEs:
      "Pedimos para llevar después de la playa y llegó caliente. De las mejores pizzas que he probado en Puerto Escondido.",
    textEn:
      "We ordered takeaway after the beach and it arrived hot. Among the best pizzas I’ve tried in Puerto Escondido.",
  },
  {
    id: "3",
    author: "Laura V.",
    textEs:
      "Servicio amable, buena música y pizzas con personalidad. Se nota que le invierten al horno y a la masa.",
    textEn:
      "Friendly service, good music, and pizzas with personality. You can tell they care about the oven and the dough.",
  },
  {
    id: "4",
    author: "James H.",
    textEs:
      "Excelente pizza estilo napolitano en PE. La masa perfecta y ingredientes frescos. Justo lo que queríamos después de un día en el mar.",
    textEn:
      "Great Neapolitan style pizza in PE. Crust was perfect, toppings fresh. Exactly what we wanted after a day in the water.",
  },
  {
    id: "5",
    author: "Sofía M.",
    textEs:
      "Llevamos a la familia un martes por la noche y salimos encantados. Precio justo para la calidad. Volveremos seguro.",
    textEn:
      "We brought the family on a Tuesday night and left really happy. Fair price for the quality. We’ll definitely come back.",
  },
];
