import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaPOShipping {
  spoNo?: string;
  svbid?: string;
  supplier?: string;
  supplierLocation?: string;
  supplierPO?: string;
  supplierPoDate?: Date;
  carrier?: string;
  carrierBookingRef?: string;
  BOLNumber?: string;
  containerNo?: string;
  vessellTrip?: string;
  portOfLading?: string;
  portOfEntryShipTo?: string;
  dateOfLanding?: Date;
  ETA?: Date;
  product?: string;
  drums?: number;
  pallets?: number;
  gallons?: number;
  invValue?: number;
  estTrumpDuties?: number;
  netWeightKG?: number;
  grossWeightKG?: number;
  ticoVB?: string;
  updatedETA?: Date;
  arrivalNotice?: string;
  isGensetRequired?: boolean;
  gensetInv?: string;
  gensetEmailed?: boolean;
  isCollectFeesPaid?: boolean;
  feesAmount?: number;
  estimatedDuties?: number;
  isDOCreated?: boolean;
  status?: string;
  updateShipmentTracking?: string;
  quickNote?: string;
  isSupplierInvoice?: boolean;
  isManufacturerSecurityISF?: boolean;
  isVidaBuddiesISFFiling?: boolean;
  isPackingList?: boolean;
  isCertificateOfAnalysis?: boolean;
  isCertificateOfOrigin?: boolean;
  IsBillOfLading?: boolean;
  isAllDocumentsProvidedToCustomsBroker?: boolean;
  isCustomsStatus?: boolean;
  IsDrayageAssigned?: boolean;
  truckerNotifiedDate?: Date;
  isTruckerReceivedDeliveryOrder?: boolean;
}

export interface IVidaPOCustomerPO {
  poNo?: string;
  customer?: string;
  customerLocation?: string;
  customerPONo?: string;
  customerPODate?: Date;
  requestedDeliveryDate?: Date;
  qtyOrdered?: number;
  qtyReceived?: number;
  UOM?: string;
  warehouse?: string;
  shipping: IVidaPOShipping[];
}

export interface IVidaPO extends Document {
  vbpoNo: string;
  orderType: string;
  date: Date;
  category: string;
  createdBy: string;
  createdAt: Date;
  customerPO: IVidaPOCustomerPO[];
}

const VidaPOShippingSchema: Schema = new Schema({
  spoNo: { type: String },
  svbid: { type: String },
  supplier: { type: String },
  supplierLocation: { type: String },
  supplierPO: { type: String },
  supplierPoDate: { type: Date },
  carrier: { type: String },
  carrierBookingRef: { type: String },
  BOLNumber: { type: String },
  containerNo: { type: String },
  vessellTrip: { type: String },
  portOfLading: { type: String },
  portOfEntryShipTo: { type: String },
  dateOfLanding: { type: Date },
  ETA: { type: Date },
  product: { type: String },
  drums: { type: Number },
  pallets: { type: Number },
  gallons: { type: Number },
  invValue: { type: Number },
  estTrumpDuties: { type: Number },
  netWeightKG: { type: Number },
  grossWeightKG: { type: Number },
  ticoVB: { type: String },
  updatedETA: { type: Date },
  arrivalNotice: { type: String },
  isGensetRequired: { type: Boolean },
  gensetInv: { type: String },
  gensetEmailed: { type: Boolean },
  isCollectFeesPaid: { type: Boolean },
  feesAmount: { type: Number },
  estimatedDuties: { type: Number },
  isDOCreated: { type: Boolean },
  status: { type: String },
  updateShipmentTracking: { type: String },
  quickNote: { type: String },
  isSupplierInvoice: { type: Boolean },
  isManufacturerSecurityISF: { type: Boolean },
  isVidaBuddiesISFFiling: { type: Boolean },
  isPackingList: { type: Boolean },
  isCertificateOfAnalysis: { type: Boolean },
  isCertificateOfOrigin: { type: Boolean },
  IsBillOfLading: { type: Boolean },
  isAllDocumentsProvidedToCustomsBroker: { type: Boolean },
  isCustomsStatus: { type: Boolean },
  IsDrayageAssigned: { type: Boolean },
  truckerNotifiedDate: { type: Date },
  isTruckerReceivedDeliveryOrder: { type: Boolean },
});

const VidaPOCustomerPOSchema: Schema = new Schema({
  poNo: { type: String },
  customer: { type: String }, // references VidaCustomer ideally, but String for now as per prompt
  customerLocation: { type: String },
  customerPONo: { type: String },
  customerPODate: { type: Date },
  requestedDeliveryDate: { type: Date },
  qtyOrdered: { type: Number },
  qtyReceived: { type: Number },
  UOM: { type: String },
  warehouse: { type: String }, // references VidaWarehouse
  shipping: [VidaPOShippingSchema],
});

const VidaPOSchema: Schema = new Schema({
  vbpoNo: { type: String, required: true, unique: true },
  orderType: { type: String },
  date: { type: Date, default: Date.now },
  category: { type: String },
  createdBy: { type: String }, // User ID or Name
  createdAt: { type: Date, default: Date.now },
  customerPO: [VidaPOCustomerPOSchema],
});

const VidaPO: Model<IVidaPO> = mongoose.models.VidaPO || mongoose.model<IVidaPO>('VidaPO', VidaPOSchema);

export default VidaPO;
