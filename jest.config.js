const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
    ...jestConfig,
    // The engine of sfdx-lwc-jest 8 ships as an ES module first; Jest needs the CommonJS build.
    moduleNameMapper: {
        "^lwc$": "<rootDir>/node_modules/@lwc/engine-dom/dist/index.cjs"
    },
    modulePathIgnorePatterns: ["<rootDir>/.localdevserver"]
};
