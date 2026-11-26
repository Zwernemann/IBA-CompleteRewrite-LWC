// Stand-in for c/crgenerator, the module of the CRGenerator package (Zwernemann/realreports),
// which is not part of this repository. Records the calls so tests can check them.
export const downloadPdf = jest.fn(() => Promise.resolve({ fileName: "IBA Report.pdf", delivered: true, pageCount: 1 }));
export const loadEngine = jest.fn(() => Promise.resolve("resource"));
export const preload = jest.fn(() => Promise.resolve());
export const describeReport = jest.fn(() => Promise.resolve({ name: "IBA Report", parts: ["IBA_00_0100_00.rpt", "IBA_01_0100_00.rpt"], virtual: true }));
export const pdfBlob = jest.fn(() => Promise.resolve({ blob: new Blob(["%PDF-1.7 test"], { type: "application/pdf" }), fileName: "IBA Report.pdf" }));
