# Default Conditions

## Method of Operation
To determine which blocks to check the condition of the default function draws from positions and conditions specified in the `predecessorConditions.json` or `successorConditions.json` files.

The function iterates down the json file recursively, when encountering a `condition` node it indicates that that condition must be met for the block position specified in `blockconditions` and all other positions after it. Whereas a failed `nc_condition` still allows the conditions for any further `blockconditions` to be met.