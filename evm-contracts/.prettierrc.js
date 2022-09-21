module.exports = {
    trailingComma: "es5",
    singleQuote: false,
    bracketSpacing: true,
    tabWidth: 4,
    overrides: [
        {
            files: "*.sol",
            options: {
                tabWidth: 4,
                printWidth: 100,
                bracketSpacing: true,
                compiler: "0.8.17",
            },
        },
    ],
};
