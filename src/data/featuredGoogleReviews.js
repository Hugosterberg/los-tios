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
    author: "Laurent",
    textEs:
      "Descubrí este restaurante por casualidad, ¡la pizza está muy buena! 🍕",
    textEn:
      "I discovered this restaurant by chance, very good pizza! 🍕",
  },
  {
    id: "2",
    author: "Lara",
    textEs:
      "La comida está increíble y el personal es muy amable. El panini boloñesa es mi favorito 👌🏽👌🏽👌🏽",
    textEn:
      "The food is amazing and the staff is very friendly. The Bolognese panini is my favorite 👌🏽👌🏽👌🏽",
  },
  {
    id: "3",
    author: "Osiris",
    textEs:
      "La pizza está deliciosa, ¡la salsa es increíble! Tenían muy buena música. Te recomiendo probar el agua saborizada que preparan ahí. No puedes irte de Puerto Escondido sin cenar aquí.",
    textEn:
      "The pizza is delicious, the sauce is amazing! They had great music. I recommend trying the flavored water they make there. You can’t go to Puerto Escondido without having dinner here.",
  },
  {
    id: "4",
    author: "Nico",
    textEs:
      "La pizza sabe increíble, los ingredientes son muy frescos y de alta calidad, y cada bocado se siente como en Italia. Además, los meseros y cocineros son súper amables y brindan un servicio perfecto. ¡La mejor pizza de Puerto!",
    textEn:
      "The pizza tastes amazing, the ingredients are so fresh and high quality, and every bite feels like Italy. Plus, the waiters and chefs are incredibly friendly and provide perfect service. Best pizza in Puerto!",
  },
  {
    id: "5",
    author: "Irlanda",
    textEs:
      "¡Delicioso! 👌🏻 Buenos ingredientes y la entrega fue muy rápida. 👌🏻 No tomé foto porque prácticamente me lo devoré 😬😋",
    textEn:
      "Delicious! 👌🏻 Good ingredients and the delivery was very fast. 👌🏻 I didn’t take a picture because I practically devoured it 😬😋",
  },
  {
    id: "6",
    author: "Theo",
    textEs:
      "¡Por fin llegaron pizzas buenas y auténticas a Puerto a precios locales! Lo que lograron los chicos de Los Tíos es un verdadero placer. Ambiente increíble, buen servicio y un sabor inigualable. Recomiendo muchísimo visitar esta pizzería céntrica.",
    textEn:
      "Finally, some good, real pizzas have arrived in Puerto at local prices! What the guys at Los Tíos have achieved is a real treat. Amazing atmosphere, great service, and unbeatable flavor. I highly recommend visiting this centrally located pizzeria.",
  },
];
