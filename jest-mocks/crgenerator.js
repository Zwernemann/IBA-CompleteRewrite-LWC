// Stand-in for c/crgenerator, the module of the CRGenerator package (Zwernemann/realreports),
// which is not part of this repository. Records the calls so tests can check them.
export const downloadPdf = jest.fn(() => Promise.resolve({ fileName: "IBA Report.pdf", delivered: true, pageCount: 1 }));
export const loadEngine = jest.fn(() => Promise.resolve("resource"));
export const preload = jest.fn(() => Promise.resolve());
