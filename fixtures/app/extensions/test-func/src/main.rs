use output::FunctionError;
use shopify_function::prelude::*;
use shopify_function::Result;

use graphql_client;
use serde::{Deserialize, Serialize};

generate_types!(
    query_path = "./input.graphql",
    schema_path = "./schema.graphql"
);

#[derive(Serialize, Deserialize, Default, PartialEq)]
struct Config {}

#[shopify_function]
fn function(input: input::ResponseData) -> Result<output::FunctionResult> {
    let mut errors = Vec::new();

    if input
        .cart
        .lines
        .iter()
        .map(|line| line.quantity)
        .any(|quantity| quantity > 1)
    {
        errors.push(FunctionError {
            localized_message: "Not possible to order more than one of each".to_owned(),
            target: "cart".to_owned(),
        })
    }
    Ok(output::FunctionResult { errors })
}

#[cfg(test)]
mod tests;
