const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
    ...jestConfig,
    // The engine of sfdx-lwc-jest 8 ships as an ES module first; Jest needs the CommonJS build.
    moduleNameMapper: {
        "^lwc$": "<rootDir>/node_modules/@lwc/engine-dom/dist/index.cjs",
        // The CRGenerator is another package; its module is a stand-in in the tests.
        "^c/crgenerator$": "<rootDir>/jest-mocks/crgenerator.js",
        "^lightning/actions$": "<rootDir>/jest-mocks/lightningActions.js"
    },
    modulePathIgnorePatterns: ["<rootDir>/.localdevserver"],
    // e2e/ holds the Playwright tests against an org, not Jest tests.
    testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"]
};
