const mongoose = require("mongoose");

const OrderProductSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: Number,
      price: Number,
      colorName:String,

    },
  ],


  isRedZone:Boolean,
  includeGiftBox:Boolean,
  deliveryTimeMessage:String,
  deliveryPartnerPrice:Number,
  orderedBefore12PM:Boolean,

  OrderedAt: String,

  // Updated shipping location to handle coordinates and address

    latitude: {
      type: Number,
      required: false,
    },
    longitude: {
      type: Number,
      required: false,
    },
    locationAddress: {
      type: String,
      required: false,
    },

      isInsideValley: Boolean,
  

  productOrderId: String,
  date: {
    type: Date,
    default: Date.now, // Automatically sets current date/time when a document is created
  },
  shippingPrice: Number,
  totalAmount: Number,
  phoneNumber: String,
  isHomeDelivery:Boolean,
  shippingLocation:String,
  paymentMethod:String,

    isScanned: {
    type: Boolean,
    default: false
  },
  scannedAt: {
    type: Date
  },

        deliveryPartner: String
 
  // timestamps: true
});

module.exports = mongoose.model("Orders", OrderProductSchema);
