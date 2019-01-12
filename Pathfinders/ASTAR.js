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

    function ASTARReturnState(MainPromise)
    {
        const ReturnState = this;
        this.on = function(Callback)
        {
            MainPromise.then(function(IntermediateObject)
            {
                ReturnState.ENUMStatus = IntermediateObject.ENUMStatus;

                if (IntermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                {
                    ReturnState.ClosestPoint = IntermediateObject.State.p;
                    console.warn(
                        'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                        'returned path to closest valid end point'
                    );
                }

                // Builds path
                let State = IntermediateObject.State;
                const Path = [State.p];
                while (State.cF)
                {
                    State = State.cF;
                    Path.push(State.p);
                }
                ReturnState.path = Path;

                Callback(ReturnState);
            }).catch(function(e) {console.error('ERROR Pathfinder:', e);});
        };
    }

    // Closed list functions
    const S = [];
    S.push = function(s)
    {
        const x = s.p.x >>> 0;
        const y = s.p.y >>> 0;

        if (!this[x])
            this[x] = [];
        if (!this[x][y])
            this[x][y] = [];

        this[x][y][s.p.z >>> 0] = s;
    };
    S.check = function(p)
    {
        const x = p.x >>> 0;
        if (this[x])
        {
            const y = p.y >>> 0;
            if (this[x][y])
            {
                if (this[x][y][p.z >>> 0])

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

    function State(p)
    {
        if (S.check(p))
            return S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else
        {
            this.p = p;
            this.g = Number.POSITIVE_INFINITY;
            this.f = Number.POSITIVE_INFINITY;

            this.cF;
            this.C = false;

            S.push(this);
        }
    };

    // Maintain familiarity with original heap implementation
    O.remove = O._removeAt;
    O.push = O.add;
    O.pop = O.poll;

    const MainPromise = new Promise(function(resolve)
    {
        // Maintains the element with the best path
        let closest = new State(sp.floored());
        closest.g = 0; // Otherwise POSITIVE_INFINITY - POSITIVE_INFINITY returns NaN

        const end = new State(ep.floored());
        const start = new State(sp.floored());
        start.g = 0;
        start.f = bot.pathfinder.HEURISTIC(start.p, end.p);

        O.push(start);

        for (let i = 0; i < bot.pathfinder.MAX_EXPANSIONS && O.size !== 0; i++)
        {
            const u = O.pop();
            if (u === end)
                return resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Complete, State: u});

            const successors = bot.pathfinder.getSuccessors(u.p);
            for (let n = 0, len = successors.length; n < len; n++)
            {
                const s = new State(successors[n]);
                const g_new = u.g + bot.pathfinder.COST(u.p, s.p);

                if (s.g <= g_new) continue;
                else if (s.C === true)
                    s.C = false;

                s.cF = u;
                s.g = g_new;
                s.f = s.g + bot.pathfinder.HEURISTIC(s.p, end.p);
                O.push(s);
            };

            u.C = true;
            // Retains the closest element to the end
            if (u.f - u.g < closest.f - closest.g) closest = u;
        };

        return resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Incomplete, State: closest});
    });

    return new ASTARReturnState(MainPromise);
};
