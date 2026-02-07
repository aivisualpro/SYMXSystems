
import { getSeaRatesTracking } from '@/lib/searates';
import connectToDatabase from '@/lib/db';
import SymxPO from '@/lib/models/SymxPO';
import SymxNotification from '@/lib/models/SymxNotification';

export async function refreshContainerTracking(container: string) {
  if (!container) {
    throw new Error('Container number is required');
  }

  // 1. Fetch live data from SeaRates
  const data = await getSeaRatesTracking(container);

  // 2. Connect to DB and find the relevant PO containing this container
  await connectToDatabase();
  
  const pos = await SymxPO.find({
    "customerPO.shipping.containerNo": container
  }).lean();

  if (pos && pos.length > 0) {
    for (const po of pos) {
      let shippingRecord = null;

      // Locate the specific shipping record
      if (po.customerPO) {
        // @ts-ignore
        for (let i = 0; i < po.customerPO.length; i++) {
          const cpo = po.customerPO[i];
          if (cpo.shipping) {
            for (let j = 0; j < cpo.shipping.length; j++) {
              if (cpo.shipping[j].containerNo === container) {
                shippingRecord = cpo.shipping[j];
                break;
              }
            }
          }
          if (shippingRecord) break;
        }
      }

      if (shippingRecord) {
        // @ts-ignore
        const history = shippingRecord.shippingTrackingRecords || [];
        const lastRecord = history.length > 0 ? history[history.length - 1] : null;

        let hasChanged = true;
        if (lastRecord) {
          const keysToCompare = [
            'status', 'latlong', 'last_event_date', 'last_event_status', 
            'last_event_location', 'pod_predictive_eta', 'pol_date', 'pod_date'
          ];
          
          const isSame = keysToCompare.every(k => {
             // @ts-ignore
             return lastRecord[k] === data[k];
          });

          if (isSame) {
            hasChanged = false;
          }
        }

        if (hasChanged) {
          // @ts-ignore
          const newRecord = { ...data, timestamp: new Date() };

          // Determine new status
          let newStatus = data.status;
          const statusUpper = newStatus ? newStatus.toUpperCase() : "";
          if (statusUpper === 'UNKNOWN' || statusUpper === 'ERROR') {
            newStatus = 'Delivered';
          }

          // Atomic update
          await SymxPO.updateOne(
            // @ts-ignore
            { _id: po._id, "customerPO.shipping.containerNo": container },
            { 
              $push: { "customerPO.$[cpo].shipping.$[ship].shippingTrackingRecords": newRecord },
              $set: { "customerPO.$[cpo].shipping.$[ship].status": newStatus }
            },
            {
              arrayFilters: [
                { "cpo.shipping.containerNo": container },
                { "ship.containerNo": container }
              ]
            }
          );

          // Create a notification
          await SymxNotification.create({
            title: `Shipment Update: ${container}`,
            message: `Status changed to ${newStatus}. Last event: ${data.last_event_status || 'N/A'} at ${data.last_event_location || 'unknown location'}.`,
            type: 'info',
            relatedId: container,
            link: '/admin/live-shipments'
          });
        }
      }
    }
  }
  return data;
}
