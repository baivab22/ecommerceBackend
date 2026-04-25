const mongoose = require("mongoose");

const OrderProductSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,   // allows guest orders with no account
  },

  // Guest checkout fields (only populated when userId is absent)
  email: { type: String, required: false },
  fullName: { type: String, required: false },
  isGuestCheckout: { type: Boolean, default: false },

  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: Number,
      price: Number,
      colorName: String,
    },
  ],

giftBoxCharge:Number,
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
  ncmVendorRefId: {
    type: String,
  },
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


  orderNote:String,

    isScanned: {
    type: Boolean,
    default: false
  },
  scannedAt: {
    type: Date
  },

    isConfirmed: {
      type: Boolean,
      default: false,
    },
    confirmedAt: {
      type: Date,
    },

    ncmOrderId: {
      type: String,
    },
    ncmPickupCreatedAt: {
      type: Date,
    },
    ncmSyncStatus: {
      type: String,
      enum: ['pending', 'success', 'failed', 'skipped'],
      default: 'pending',
    },
    ncmSyncError: {
      type: String,
    },
    ncmRetryCount: {
      type: Number,
      default: 0,
    },
    ncmNextRetryAt: {
      type: Date,
    },
    ncmLastSyncAt: {
      type: Date,
    },
    ncmLastStatus: {
      type: String,
    },
    ncmLastStatusAt: {
      type: Date,
    },
    ncmLastNotifiedStatus: {
      type: String,
    },
    ncmLastStatusNotifiedAt: {
      type: Date,
    },
    ncmNotifiedStatusKeys: {
      type: [String],
      default: [],
    },
    ncmLastComment: {
      type: String,
    },
    ncmLastCommentAt: {
      type: Date,
    },
    ncmLastWebhookEvent: {
      type: String,
    },
    ncmLastWebhookAt: {
      type: Date,
    },
    ncmDestinationBranch: {
      type: String,
    },

        deliveryPartner: String
 
  // timestamps: true
});

OrderProductSchema.index({ isConfirmed: 1, ncmSyncStatus: 1, ncmNextRetryAt: 1, ncmOrderId: 1 });
OrderProductSchema.index({ ncmOrderId: 1 });

module.exports = mongoose.model("Orders", OrderProductSchema);
