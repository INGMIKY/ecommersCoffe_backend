//@ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY);
import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    try {
      const { products } = ctx.request.body;

      const line_items = await Promise.all(
        products.map(async (product) => {
          console.log("Producto recibido:", product);

          // ✅ usar documentId
          const item = await strapi
            .service("api::product.product")
            .findOne(product.documentId);

          if (!item) {
            throw new Error(`Producto con documentId ${product.documentId} no encontrado`);
          }

          console.log("Item encontrado en BD:", item);

          return {
            price_data: {
              currency: "mxn",
              product_data: { name: item.productName },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: product.quantity || 1,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: { allowed_countries: ["MX"] },
        payment_method_types: ["card"],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/success`,
        cancel_url: `${process.env.CLIENT_URL}/cancel`,
        line_items,
      });

      await strapi.service("api::order.order").create({
        data: { products, stripeId: session.id },
      });

      ctx.body = { url: session.url };
    } catch (error) {
      console.error("Error al crear la sesión de Stripe:", error);
      ctx.response.status = 500;
      ctx.body = { error: error.message };
    }
  },
}));
