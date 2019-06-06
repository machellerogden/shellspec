'use strict';

const Joi = require('@hapi/joi');

const {
    alternatives,
    any,
    object,
    string,
    array,
    boolean,
    lazy
} = Joi.bind();

const semverRegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/;

const conditionalsSchema = alternatives([
    string(),
    array().items(string())
]);

const useValueTypesSchema = string().valid('string', 'number', 'boolean');

const argsSchema = array().items(
    string(), 
    object({
        name: string().required(),
        key: string(),
        aka: alternatives([
            string(),
            array().items(string())
        ]),
        type: string().valid(
            'option',
            'flag',
            'value',
            'values',
            'variable',
            'collection',
            '--'),
        value: any(),
        default: any(),
        choices: array().items(boolean(), string()),
        with: conditionalsSchema,
        withAll: conditionalsSchema,
        without: conditionalsSchema,
        when: conditionalsSchema,
        whenAll: conditionalsSchema,
        unless: conditionalsSchema,
        required: boolean(),
        useValue: alternatives([
            array().items(useValueTypesSchema),
            useValueTypesSchema,
            boolean()
        ]),
        join: alternatives([
            boolean(),
            string().allow('')
        ]),
        concatable: boolean(),
        message: string(),
        description: string()
    })
);

const commandSchema = object({
    args: argsSchema,
    commands: object().pattern(string(), lazy(() => commandSchema))
});

const versionsSchema = object().pattern(
    string(),
    alternatives([
        string(),
        commandSchema
    ])
);

const specSchema = commandSchema.keys({
    main: string(),
    versions: versionsSchema,
    collections: object().pattern(
        string(),
        argsSchema
    )
});

const definitionSchema = object({
    kind: string().valid('shell'),
    version: string().regex(semverRegExp),
    spec: specSchema
});

module.exports = definitionSchema;
