use super::*;
use shopify_function::{run_function_with_input, Result};

#[test]
fn test_result_contains_no_operations() -> Result<()> {
    let result = run_function_with_input(
        function,
        r#"
            {
                "cart": {
                    "lines": [
                        {
                            "quantity": 3
                        }
                    ]
                }
            }
        "#,
    )?;
    let mut errors = Vec::new();
    errors.push(FunctionError {
        localized_message: "Not possible to order more than one of each".to_owned(),
        target: "cart".to_owned(),
    });
    let expected = crate::output::FunctionResult { errors: errors };

    assert_eq!(result, expected);
    Ok(())
}
