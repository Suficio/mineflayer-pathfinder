'use strict';
const Heap = require('fastpriorityqueue');

module.exports = function(bot, sp, ep)
{
    // A* as per Peter E. Hart, Nils J. Nilsson, Bertram Raphael, 1968
    // Roughly as described in https://en.wikipedia.org/wiki/A*_search_algorithm#Pseudocode

    // I was not able to get JPS working faster than the original A* algorithim despite greately increasing the speed of getBlock. It may be a futile effort
    // unless anyone has any ideas as to how to optimize it.

    // Converting the closed list to a one dimensional array should be considered, I did not manage to get an integer hashtable to work faster than the
    // current implementation, this could have been due to an expenisve computation of the hash, however easier to compute hashes collided too frequently.
    // Additionally nested arrays allow the AI to traverse the entirety of the world instead of being limited by integer limits.

    function ASTARReturnState(mainPromise)
    {
        const returnState = this;

        mainPromise
            .then(function(intermediateObject)
            {
                returnState.ENUMStatus = intermediateObject.ENUMStatus;

                if (intermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                {
                    console.warn(
                        'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                        'returned path to closest valid end point'
                    );
                }

                // Builds path
                let state = intermediateObject.state;
                const path = [state.c];

                while (state.cF)
                {
                    state = state.cF;
                    path.push(state.c);
                }
                returnState.path = path;

                resolve(returnState);
            })
            .catch(function(e) {console.error('ERROR Pathfinder:', e);});
    }

    // Closed list functions
    const S = [];
    S.push = function(s)
    {
        const x = s.c.x >>> 0;
        const y = s.c.y >>> 0;

        if (!this[x])
            this[x] = [];
        if (!this[x][y])
            this[x][y] = [];

        this[x][y][s.c.z >>> 0] = s;
    };
    S.check = function(c)
    {
        const x = c.x >>> 0;
        if (this[x])
        {
            const y = c.y >>> 0;
            if (this[x][y])
            {
                if (this[x][y][c.z >>> 0])
                    return true;
            }
        } return false;
    };

    // Open list functions
    const O = new Heap(function(s1, s2) {return s1.f < s2.f;});
    O.check = function(s)
    {
        for (let i = 0; i < this.size; i++)
            if (this.array[i] === s) return i;
        return undefined;
    };

    function State(c)
    {
        if (S.check(c))
            return S[c.x >>> 0][c.y >>> 0][c.z >>> 0];
        else
        {
            this.c = c;
            this.g = Number.POSITIVE_INFINITY;
            this.f = Number.POSITIVE_INFINITY;

            this.p = null;
            this.closed = false;

            S.push(this);
        }
    };

    // Maintain familiarity with original heap implementation
    O.remove = O._removeAt;
    O.push = O.add;
    O.pop = O.poll;

    const mainPromise = new Promise(function(resolve)
    {
        const end = new State(ep.floored());
        const start = new State(sp.floored());
        start.g = 0;
        start.f = bot.pathfinder.HEURISTIC(start.c, end.c);

        O.push(start);

        let closest = start;

        for (let i = 0; i < bot.pathfinder.MAX_EXPANSIONS && O.size !== 0; i++)
        {
            const u = O.pop();
            if (u === end)
                return resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Complete, state: u});

            const successors = bot.pathfinder.getSuccessors(u.c);
            for (let n = 0, len = successors.length; n < len; n++)
            {
                const s = new State(successors[n]);
                const g_new = u.g + bot.pathfinder.COST(u.c, s.c);

                if (s.g <= g_new) continue;
                else if (s.closed === true)
                    s.closed = false;

                s.p = u;
                s.g = g_new;
                s.f = s.g + bot.pathfinder.HEURISTIC(s.c, end.c);
                O.push(s);
            };

            u.closed = true;
            // Retains the closest element to the end
            if (u.f - u.g < closest.f - closest.g) closest = u;
        };

        return resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Incomplete, state: closest});
    });

    const returnState = new ASTARReturnState(mainPromise);

    return new Promise(function(resolve)
    {
        mainPromise.then(function()
        {
            resolve(returnState);
        });
    });
};
