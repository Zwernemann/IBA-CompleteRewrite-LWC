import getRows from "@salesforce/apex/DibaPlantController.getRows";
import { prepareRow, refreshCalculated } from "c/dibaRowLogic";

/**
 * The rows of a plant, loaded once per page and shared: the plant view needs them for the
 * sliders and the report XML, the asset table for editing. Both get the same row objects,
 * so a change in the table is in the report without loading again.
 */

const PAGE_SIZE = 2000;
const cache = new Map();

/**
 * All rows of a plant, prepared (edits applied, risk and obsolescence calculated).
 *
 * @param plantId    id of the DIBA_Account__c
 * @param onProgress optional, called with the number of rows loaded so far
 */
export function loadRows(plantId, onProgress) {
    if (!cache.has(plantId)) {
        const promise = fetchAll(plantId, onProgress);
        promise.catch(() => cache.delete(plantId));
        cache.set(plantId, promise);
    }
    return cache.get(plantId);
}

/** Forgets the rows of a plant, so that the next loadRows reads them anew. */
export function forgetRows(plantId) {
    cache.delete(plantId);
}

async function fetchAll(plantId, onProgress) {
    const rows = [];
    let after = null;
    do {
        // Sequential on purpose: each page starts after the last key of the one before.
        // eslint-disable-next-line no-await-in-loop
        const page = await getRows({ plantId, afterKey: after, pageSize: PAGE_SIZE });
        for (const raw of page.rows) {
            const row = prepareRow({ ...raw });
            refreshCalculated(row);
            rows.push(row);
        }
        if (onProgress) onProgress(rows.length);
        after = page.nextAfter;
    } while (after);
    return rows;
}
