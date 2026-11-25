import getRows from "@salesforce/apex/DibaAccountController.getRows";
import { prepareRow, refreshCalculated } from "c/dibaRowLogic";

/**
 * The rows of an account, loaded once per page and shared: the account view needs them for the
 * sliders and the report XML, the asset table for editing. Both get the same row objects,
 * so a change in the table is in the report without loading again.
 */

const PAGE_SIZE = 2000;
const cache = new Map();

/**
 * All rows of an account, prepared (edits applied, risk and obsolescence calculated).
 *
 * @param accountDataId    id of the DIBA_Account__c
 * @param onProgress optional, called with the number of rows loaded so far
 */
export function loadRows(accountDataId, onProgress) {
    if (!cache.has(accountDataId)) {
        const promise = fetchAll(accountDataId, onProgress);
        promise.catch(() => cache.delete(accountDataId));
        cache.set(accountDataId, promise);
    }
    return cache.get(accountDataId);
}

/** Forgets the rows of an account, so that the next loadRows reads them anew. */
export function forgetRows(accountDataId) {
    cache.delete(accountDataId);
}

async function fetchAll(accountDataId, onProgress) {
    const rows = [];
    let after = null;
    do {
        // Sequential on purpose: each page starts after the last key of the one before.
        // eslint-disable-next-line no-await-in-loop
        const page = await getRows({ accountDataId, afterKey: after, pageSize: PAGE_SIZE });
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
