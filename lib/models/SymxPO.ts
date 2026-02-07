import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxPOShipping {
  _id?: string;
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
  isSymxSystemsISFFiling?: boolean;
  isPackingList?: boolean;
  isCertificateOfAnalysis?: boolean;
  isCertificateOfOrigin?: boolean;
  IsBillOfLading?: boolean;
  isAllDocumentsProvidedToCustomsBroker?: boolean;
  isCustomsStatus?: boolean;
  IsDrayageAssigned?: boolean;
  truckerNotifiedDate?: Date;
  isTruckerReceivedDeliveryOrder?: boolean;
  itemNo?: string;
  description?: string;
  lotSerial?: string;
  qty?: number;
  type?: string;
  inventoryDate?: Date;
  shippingTrackingRecords?: IShippingTrackingRecord[];
}

export interface IShippingTrackingRecord {
  type?: string;
  number?: string;
  sealine?: string;
  sealine_name?: string;
  status?: string;
  updated_at?: string;
  from_port_name?: string;
  from_port_country?: string;
  from_port_locode?: string;
  to_port_name?: string;
  to_port_country?: string;
  to_port_locode?: string;
  pol_name?: string;
  pol_date?: string;
  pol_actual?: boolean | string;
  pod_name?: string;
  pod_date?: string;
  pod_actual?: boolean | string;
  pod_predictive_eta?: string;
  container_iso_code?: string;
  container_size_type?: string;
  vessel_names?: string;
  vessel_imos?: string;
  last_event_code?: string;
  last_event_status?: string;
  last_event_date?: string;
  last_event_location?: string;
  last_event_facility?: string;
  last_event_vessel?: string;
  last_event_voyage?: string;
  latlong?: string;
  timestamp: Date;
}

export interface ISymxPOCustomerPO {
  _id?: string;
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
  shipping: ISymxPOShipping[];
}

export interface ISymxPO extends Document {
  vbpoNo: string;
  orderType: string;
  date: Date;
  category: string;
  createdBy: string;
  createdAt: Date;
  customerPO: ISymxPOCustomerPO[];
}

const SymxPOShippingSchema: Schema = new Schema({
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
  isSymxSystemsISFFiling: { type: Boolean },
  isPackingList: { type: Boolean },
  isCertificateOfAnalysis: { type: Boolean },
  isCertificateOfOrigin: { type: Boolean },
  IsBillOfLading: { type: Boolean },
  isAllDocumentsProvidedToCustomsBroker: { type: Boolean },
  isCustomsStatus: { type: Boolean },
  IsDrayageAssigned: { type: Boolean },
  truckerNotifiedDate: { type: Date },
  isTruckerReceivedDeliveryOrder: { type: Boolean },
  itemNo: { type: String },
  description: { type: String },
  lotSerial: { type: String },
  qty: { type: Number },
  type: { type: String },
  inventoryDate: { type: Date },

  shippingTrackingRecords: [{
    type: { type: String },
    number: String,
    sealine: String,
    sealine_name: String,
    status: String,
    updated_at: String,
    from_port_name: String,
    from_port_country: String,
    from_port_locode: String,
    to_port_name: String,
    to_port_country: String,
    to_port_locode: String,
    pol_name: String,
    pol_date: String,
    pol_actual: Schema.Types.Mixed, // boolean or string
    pod_name: String,
    pod_date: String,
    pod_actual: Schema.Types.Mixed, // boolean or string
    pod_predictive_eta: String,
    container_iso_code: String,
    container_size_type: String,
    vessel_names: String,
    vessel_imos: String,
    last_event_code: String,
    last_event_status: String,
    last_event_date: String,
    last_event_location: String,
    last_event_facility: String,
    last_event_vessel: String,
    last_event_voyage: String,
    latlong: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

const SymxPOCustomerPOSchema: Schema = new Schema({
  poNo: { type: String },
  customer: { type: String }, // references SymxCustomer ideally, but String for now as per prompt
  customerLocation: { type: String },
  customerPONo: { type: String },
  customerPODate: { type: Date },
  requestedDeliveryDate: { type: Date },
  qtyOrdered: { type: Number },
  qtyReceived: { type: Number },
  UOM: { type: String },
  warehouse: { type: String }, // references SymxWarehouse
  shipping: [SymxPOShippingSchema],
});

const SymxPOSchema: Schema = new Schema({
  vbpoNo: { type: String, required: true, unique: true },
  orderType: { type: String },
  date: { type: Date, default: Date.now },
  category: { type: String },
  createdBy: { type: String }, // User ID or Name
  createdAt: { type: Date, default: Date.now },
  customerPO: [SymxPOCustomerPOSchema],
});

const SymxPO: Model<ISymxPO> = mongoose.models.SymxPO || mongoose.model<ISymxPO>('SymxPO', SymxPOSchema);

export default SymxPO;
