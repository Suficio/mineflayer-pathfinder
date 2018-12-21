# Mineflayer-Pathfinder
Fast, promise based, 3D pathfinding library using A* and D*Lite algorithms, for Mineflayer found under: [https://github.com/superjoe30/mineflayer/](https://github.com/superjoe30/mineflayer/)

## Table of Contents
- [Mineflayer-Pathfinder](#mineflayer-pathfinder)
    - [Features](#features)
    - [Table of Contents](#table-of-contents)
    - [Basic Usage](#basic-usage)
    - [Advanced Usage](#advanced-usage)
    - [Documentation](#documentation)
        - [bot.pathfinder.to( startPoint, endPoint [, ENUMPathfinder])](#botpathfinderto-startpoint-endpoint--enumpathfinder)
        - [bot.pathfinder.getSuccessors( position)](#botpathfindergetsuccessors-position)
        - [bot.pathfinder.getPredecessors( position)](#botpathfindergetpredecessors-position)
        - [bot.pathfinder.getBlock( position)](#botpathfindergetblock-position)
        - [bot.pathfinder.MAX_EXPANSIONS](#botpathfindermax_expansions)
        - [bot.pathfinder.HEURISTIC( startPoint, EndPoint)](#botpathfinderheuristic-startpoint-endpoint)
        - [bot.pathfinder.COST](#botpathfindercost)
        - [bot.pathfinder.ENUMPathfinder](#botpathfinderenumpathfinder)
        - [bot.pathfinder.ENUMStatus](#botpathfinderenumstatus)
    - [Algorithm Documentation](#algorithm-documentation)

## Features
* Provides high level API for determining paths between two points
* Multiple algorithms for pathfinding, A* and D*Lite
* Exposed internal functions to allow easier user replacement
* Based solely on a promise based API

## Basic Usage
To get started just paste this code into your bot:
```js
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder');

// Install pathfinder
pathfinder(bot);

bot.on('chat', function(username, message)
{
    // Find path to whoever talked
    if (message === 'come')
    {
        bot.pathfinder
            .to(
                bot.entity.position,
                bot.players[username].entity.position
            )
            .on(function(ReturnState)
            {
                const path = ReturnState.path;
                // Move bot along path and youre done!
            });
    }
}
```

## Advanced Usage

## Documentation

### bot.pathfinder.to( startPoint, endPoint [, ENUMPathfinder])
Attempts a path search from the start point to the end point using the provided pathfinder.

* `startPoint` - the point from which you want to find the path
* `endPoint` - the end point of the path
* `ENUMPathfinder` - specifies which pathfinding algorithim to use, see `bot.pathfinder.ENUMPathfinder`
  * Defaults to `bot.pathfinder.ENUMPathfinder.ASTAR`

Returns a return object based on the `ENUMPathfinder` provided, see Algorithim Documentation.

### bot.pathfinder.getSuccessors( position)
Determines positions to which the bot can move from the given position. There is some discussion about how the default function for `getSuccessors` works at [Default Conditions](https://github.com/CheezBarger/Mineflayer-Pathfinder/tree/master/DefaultConditions)

`position` - coordinates of the position you want to move from

### bot.pathfinder.getPredecessors( position)
Determines positions from which the bot could have moved to the given position.

`position` - coordinates of the position you want to move to

### bot.pathfinder.getBlock( position)
Slightly faster version of `bot.blockAt`

`position` - coordinates of the block from which you want to get data

### bot.pathfinder.MAX_EXPANSIONS
Integer values which determines the maximum ammount of positions an algorithim will inspect, defaults to 80000.

### bot.pathfinder.HEURISTIC( startPoint, EndPoint)
Determines the heuristic value from the `startPoint` to the `endPoint`. Defaults to euclidean distance.

### bot.pathfinder.COST( startPoint, EndPoint)
Determines the cost value from the `startPoint` to the `endPoint`. Defaults to `bot.pathfinder.HEURISTIC`.

### bot.pathfinder.ENUMPathfinder
Object with the following properties:
* `ASTAR` - Refers to the standard A* algorithm, see A* Pathfinding
* `DLITE` - Refers to the optimized D* lite algorithm, see D* Lite Pathfinding
* `UDLITE` - Refers to the unoptimized D* lite algorithm, see D* Lite Pathfinding

### bot.pathfinder.ENUMStatus
Object with the following properties:
* `Complete` - Occurs when the path could be successfully computed
* `Incomplete` - Occurs when the pathfinder encountered an error or could not compute the complete path

## Algorithm Documentation
Detailed overview of the algorithms used avaliable at [Algorithm Documentation](https://github.com/CheezBarger/Mineflayer-Pathfinder/tree/master/Pathfinders)
