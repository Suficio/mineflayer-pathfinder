'use strict';

const escodegen = require('escodegen');

const Vec3 = require('vec3');

const cardinalDirectionVectors3D = [
    new Vec3(1, 0, -1), // north
    new Vec3(1, 0, 1), // east
    new Vec3(-1, 0, 1), // south
    new Vec3(-1, 0, -1), // west
];

// ESTree shorthands

function BlockStatement(body) {this.type = 'BlockStatement'; this.body = body;};
function VariableDeclaration(declarations, kind) {this.type = 'VariableDeclaration'; this.declarations = declarations; this.kind = kind;};
function VariableDeclarator(id, init) {this.type = 'VariableDeclarator'; this.id = id; this.init = init;};
function ReturnStatement(argument) {this.type = 'ReturnStatement'; this.argument = argument;};
function Identifier(name) {this.type = 'Identifier'; this.name = name;};
function ArrayExpression(elements) {this.type = 'ArrayExpression'; this.elements = elements;};
function CallExpression(callee, args) {this.type = 'CallExpression'; this.callee = callee; this.arguments = args;};
function MemberExpression(object, property) {this.type = 'MemberExpression'; this.computed = false; this.object = object; this.property = property;};
function Literal(value) {this.type = 'Literal'; this.value = value;};
function LogicalExpression(operator, left, right) {this.type = 'LogicalExpression'; this.operator = operator; this.left = left; this.right = right;};
function BinaryExpression(operator, left, right) {this.type = 'BinaryExpression'; this.operator = operator; this.left = left; this.right = right;}
function IfStatement(test, consequent, alternate) {this.type = 'IfStatement'; this.test = test; this.consequent = consequent; this.alternate = alternate;};
function ExpressionStatement(expression) {this.type = 'ExpressionStatement'; this.expression = expression;};
function UnaryExpression(operator, argument) {this.type = 'UnaryExpression'; this.operator = operator; this.argument = argument;};
function FunctionExpression(id, params, body, generator) {this.type = 'FunctionExpression'; this.id = id; this.params = params; this.body = body; this.generator = generator;}
function AssignmentExpression(operator, left, right) {this.type = 'AssignmentExpression'; this.operator = operator; this.left = left; this.right = right;};

module.exports = function compiledNeighborSearch(bot)
{
    const successorConditions = require('./../DefaultConditions/successorConditions.json');
    const predecessorConditions = require('./../DefaultConditions/predecessorConditions.json');

    const hrstart = process.hrtime();

    bot.pathfinder.getSuccessors = compileNeighborSearch(successorConditions);
    bot.pathfinder.getPredecessors = compileNeighborSearch(predecessorConditions);

    const hrend = process.hrtime(hrstart);
    const time = hrend[0] * 1000 + hrend[1] / 1000000;
    console.log('bot.pathfinder.compileNeighborSearch: neighbors compiled in ' + time + ' ms');

    function compileNeighborSearch(conditions)
    {
        const rootBlock = [];
        rootBlock.push(
            new VariableDeclaration(
                [
                    new VariableDeclarator(
                        new Identifier('returnArray'),
                        new ArrayExpression([])
                    ),
                ],
                'const'
            )
        );

        for (let m = 0; m < 4; m++)
        {
            for (let i = 0, il = conditions.length; i < il; i++)
                parseConditions(conditions[i], cardinalDirectionVectors3D[m], rootBlock);
        }

        rootBlock.push(
            new ReturnStatement(
                new Identifier('returnArray')
            )
        );

        // Finalize

        const AST = new ExpressionStatement(
            new AssignmentExpression(
                '=',
                new Identifier('getCardinalNeighbors'),
                new FunctionExpression(
                    null,
                    [
                        new Identifier('u'),
                    ],
                    new BlockStatement(rootBlock),
                    false
                )
            )
        );

        let getCardinalNeighbors;
        eval(escodegen.generate(AST));
        // console.log(String(getCardinalNeighbors));
        return getCardinalNeighbors;
    }

    function parseConditions(JSONData, direction, rootBlock)
    {
        const currentBlock = [];
        const coordinates = Vec3(JSONData.coordinates);
        const worldCoordinates = rproduct(coordinates, direction);

        currentBlock.push(
            new VariableDeclaration(
                [
                    new VariableDeclarator(
                        new Identifier('coordinate'),
                        new CallExpression(
                            new MemberExpression(
                                new Identifier('u'),
                                new Identifier('offset')
                            ),
                            [
                                compileLiteral(worldCoordinates.x),
                                compileLiteral(worldCoordinates.y),
                                compileLiteral(worldCoordinates.z),
                            ]
                        )
                    ),
                ],
                'const'
            )
        );

        const ncConditionVariables = [];
        const conditionVariables = [];

        for (let i = 0, il = JSONData.conditions.length; i < il; i++)
        {
            const condition = JSONData.conditions[i];
            const worldCoordinates = rproduct(Vec3(condition.coordinates), direction);

            if (condition.type === 'nc_condition')
            {
                ncConditionVariables.push('nc' + i);
                currentBlock.push(
                    new VariableDeclaration(
                        [
                            new VariableDeclarator(
                                new Identifier('bw_nc' + i),
                                new CallExpression(
                                    new MemberExpression(
                                        new MemberExpression(
                                            new Identifier('bot'),
                                            new Identifier('pathfinder')
                                        ),
                                        new Identifier('getBlock')
                                    ),
                                    [
                                        new CallExpression(
                                            new MemberExpression(
                                                new Identifier('u'),
                                                new Identifier('offset')
                                            ),
                                            [
                                                compileLiteral(worldCoordinates.x),
                                                compileLiteral(worldCoordinates.y),
                                                compileLiteral(worldCoordinates.z),
                                            ]
                                        ),
                                    ]
                                )
                            ),
                        ],
                        'const'
                    )
                );
                currentBlock.push(
                    new VariableDeclaration(
                        [
                            new VariableDeclarator(
                                new Identifier('nc' + i),
                                new LogicalExpression(
                                    '&&',
                                    new BinaryExpression(
                                        '!==',
                                        new Identifier('bw_nc' + i),
                                        new Identifier('undefined')
                                    ),
                                    new BinaryExpression(
                                        '===',
                                        new MemberExpression(
                                            new Identifier('bw_nc' + i),
                                            new Identifier('boundingBox')
                                        ),
                                        new Literal(condition.condition)
                                    )
                                )
                            ),
                        ],
                        'const'
                    )
                );
            }
            else if (condition.type === 'condition')
            {
                conditionVariables.push('c' + i);
                currentBlock.push(
                    new VariableDeclaration(
                        [
                            new VariableDeclarator(
                                new Identifier('bw_c' + i),
                                new CallExpression(
                                    new MemberExpression(
                                        new MemberExpression(
                                            new Identifier('bot'),
                                            new Identifier('pathfinder')
                                        ),
                                        new Identifier('getBlock')
                                    ),
                                    [
                                        new CallExpression(
                                            new MemberExpression(
                                                new Identifier('u'),
                                                new Identifier('offset')
                                            ),
                                            [
                                                compileLiteral(worldCoordinates.x),
                                                compileLiteral(worldCoordinates.y),
                                                compileLiteral(worldCoordinates.z),
                                            ]
                                        ),
                                    ]
                                )
                            ),
                        ],
                        'const'
                    )
                );
                currentBlock.push(
                    new VariableDeclaration(
                        [
                            new VariableDeclarator(
                                new Identifier('c' + i),
                                new LogicalExpression(
                                    '&&',
                                    new BinaryExpression(
                                        '!==',
                                        new Identifier('bw_c' + i),
                                        new Identifier('undefined')
                                    ),
                                    new BinaryExpression(
                                        '===',
                                        new MemberExpression(
                                            new Identifier('bw_c' + i),
                                            new Identifier('boundingBox')
                                        ),
                                        new Literal(condition.condition)
                                    )
                                )
                            ),
                        ],
                        'const'
                    )
                );
            }
            else if (condition.type === 'blockconditions')
            {
                const b0 = [];
                const b1 = [];

                currentBlock.push(
                    new IfStatement(
                        compileLogical(ncConditionVariables),
                        new IfStatement(
                            compileLogical(conditionVariables),
                            new BlockStatement(
                                [
                                    new ExpressionStatement(
                                        new CallExpression(
                                            new MemberExpression(
                                                new Identifier('returnArray'),
                                                new Identifier('push')
                                            ),
                                            [
                                                new Identifier('coordinate'),
                                            ]
                                        )
                                    ),
                                    new BlockStatement(b0),
                                ]
                            ),
                            null
                        ),
                        new BlockStatement(
                            [
                                new IfStatement(
                                    compileLogical(conditionVariables),
                                    new BlockStatement(b1),
                                    null
                                ),
                            ]
                        )
                    )
                );

                rootBlock.push(new BlockStatement(currentBlock));

                parseConditions(condition, direction, b0);
                parseConditions(condition, direction, b1);
            }
            else
            {
                currentBlock.push(
                    new IfStatement(
                        compileLogical(ncConditionVariables),
                        new IfStatement(
                            compileLogical(conditionVariables),
                            new BlockStatement(
                                [
                                    new ExpressionStatement(
                                        new CallExpression(
                                            new MemberExpression(
                                                new Identifier('returnArray'),
                                                new Identifier('push')
                                            ),
                                            [
                                                new Identifier('coordinate'),
                                            ]
                                        )
                                    ),
                                ]
                            ),
                            null
                        ),
                        null
                    )
                );

                rootBlock.push(new BlockStatement(currentBlock));
            }
        }
    }

    return compiledNeighborSearch;
};

function compileLiteral(number)
{
    if (number < 0)
        return new UnaryExpression('-', new Literal(-number));

    else
        return new Literal(number);
}

function compileLogical(array)
{
    if (array.length === 1)
        return new Identifier(array[0]);

    return new LogicalExpression(
        '&&',
        new Identifier(array.pop()),
        compileLogical(array)
    );
}

function rproduct(coordinates, direction)
{
    if (direction.x * direction.z === -1)
        return new Vec3(coordinates.z*direction.x, coordinates.y, coordinates.x*direction.z);

    else
        return new Vec3(coordinates.x*direction.x, coordinates.y, coordinates.z*direction.z);
}
