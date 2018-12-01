const Heap = require('fastpriorityqueue');

function State(p)
{
    this.p = p;
    this.g = Number.POSITIVE_INFINITY;
    this.f = Number.POSITIVE_INFINITY;
    this.cF = null;
}

function IntermediateState(ENUMStatus, State)
{
    this.ENUMStatus = ENUMStatus;

    const Path = [State.p];
    while (State.cF)
    {
        State = State.cF;
        Path.push(State.p);
    }
    this.Path = Path;
}

function ReturnState(MainPromise)
{
    this.MainPromise = MainPromise;
    this.MainPromise
        .then(function(IntermediateState)
        {
            this.ENUMStatus = IntermediateState.ENUMStatus;
            this.Path = IntermediateState.Path;
        }.bind(this))
        .catch(function() {return;});
}

module.exports = function(bot, sp, ep)
{
    // A* as per Peter E. Hart, Nils J. Nilsson, Bertram Raphael, 1968
    // Roughly as described in https://en.wikipedia.org/wiki/A*_search_algorithm#Pseudocode

    // I was not able to get JPS working faster than the original A* algorithim despite greately increasing the speed of getBlock. It may be a futile effort
    // unless anyone has any ideas as to how to optimize it.

    // Converting the closed list to a one dimensional array should be considered, I did not manage to get an integer hashtable to work faster than the
    // current implementation, this could have been due to an expenisve computation of the hash, however easier to compute hashes collided too frequently.
    // Additionally nested arrays allow the AI to traverse the entirety of the world instead of being limited by integer limits.

    const MainPromise = new Promise(function(resolve, reject)
    {
        // Closed list functions
        const C = [];
        C.push = function(s)
        {
            const x = s.p.x >>> 0;
            const y = s.p.y >>> 0;

            if (!this[x])
                this[x] = [];
            if (!this[x][y])
                this[x][y] = [];

            this[x][y][s.p.z >>> 0] = s;
        };
        C.check = function(p)
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
        const O = new Heap(function(s1, s2)
        {
            return s1.f < s2.f;
        });
        O.check = function(s)
        {
            for (let i = 0; i < this.size; i++)
                if (this.array[i].p.equals(s.p)) return i;
            return undefined;
        };
        O.replace = function(i, s)
        {
            this.array[i] = s;
            this._percolateUp(i);
        };

        // Maintain familiarity with original heap implementation
        O.push = O.add;
        O.pop = O.poll;

        // Maintains the element with the best path
        let closest = new State(sp.floored());
        closest.g = 0; // Otherwise POSITIVE_INFINITY - POSITIVE_INFINITY returns NaN

        const end = new State(ep.floored());
        const start = new State(sp.floored());
        start.g = 0;
        start.f = bot.navigate.HEURISTIC(start, end);

        O.push(start);

        for (let i = 0; i < bot.navigate.MAX_EXPANSIONS && O.size !== 0; i++)
        {
            const current = O.pop();
            if (current.p.equals(end.p))
                return resolve(new IntermediateState(bot.navigate.ENUMStatus.Complete, current));

            C.push(current);

            const successors = bot.navigate.getSuccessors(current.p);
            for (let n = 0, len = successors.length; n < len; n++)
            {
                if (C.check(successors[n])) continue;
                const s = new State(successors[n]);

                const tg = current.g + bot.navigate.COST(current, s);
                if (tg >= s.g) continue;

                s.cF = current;
                s.g = tg;
                s.f = s.g + bot.navigate.HEURISTIC(s, end);

                const m = O.check(s);
                if (!m) O.push(s); else O.replace(m, s);
            };

            // Retains the closest element to the end
            if (current.f - current.g < closest.f - closest.g) closest = current;
        };

        console.log('WARNING: Did not find path in allowed MAX_EXPANSIONS, returned closest path');
        return resolve(new IntermediateState(bot.navigate.ENUMStatus.Incomplete, CP(closest)));
    });

    return new ReturnState(MainPromise);
};
