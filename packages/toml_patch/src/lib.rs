use std::{error::Error, fmt, str::FromStr};

use toml_edit::{DocumentMut, Item, Table, TomlError as TomlEditError, Value, value};
use wasm_bindgen::prelude::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Represents an error that occurred during TOML parsing or manipulation.
#[derive(Debug)]
pub struct TomlError {
  message: String,
}

impl fmt::Display for TomlError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "TOML Patch Error: {}", self.message)
  }
}

// Implement the standard Error trait for better integration with Rust error handling.
impl Error for TomlError {}

/// Converts a `toml_edit::TomlError` into our custom `TomlError`.
impl From<TomlEditError> for TomlError {
  fn from(error: TomlEditError) -> Self {
    TomlError { message: error.to_string() }
  }
}

/// Parses a TOML string using `toml_edit` and returns the serialized result.
/// Useful for validating and potentially normalizing TOML content.
/// Returns an error if the TOML content cannot be parsed.
#[wasm_bindgen]
pub fn echo_toml(toml_content: &str) -> Result<String, String> {
  DocumentMut::from_str(toml_content).map(|doc| doc.to_string()).map_err(|e| e.to_string())
}

/// Updates TOML content with the provided key-value pairs
///
/// # Arguments
/// * `toml_content` - A string containing valid TOML
/// * `paths` - A comma-separated list of dotted paths (e.g., "a.b.c,x.y.z")
/// * `values` - A comma-separated list of values corresponding to the paths
///
/// # Returns
/// * `Ok(String)` - The updated TOML content as a string
/// * `Err(String)` - An error message if the operation fails
#[wasm_bindgen]
pub fn update_toml_values(toml_content: &str, paths_str: &str, values_str: &str) -> Result<String, String> {
  let mut doc = DocumentMut::from_str(toml_content).map_err(|e| format!("Failed to parse TOML: {}", e))?;

  for item in prepare_updates(paths_str, values_str)? {
    apply_single_update_to_doc(&mut doc, &item.path_parts, item.value_to_insert)?;
  }

  Ok(doc.to_string())
}

/// Parses a comma-separated string, trimming whitespace from each resulting item.
fn split_comma_separated_str(s: &str) -> Vec<&str> {
  s.split(',').map(|item| item.trim()).collect()
}

/// Parses the input path and value strings, validates them, creates `UpdateItem`s,
/// and sorts them for application. Sorting is crucial: longest paths first ensures
/// that deeper modifications don't invalidate paths for later, shallower updates
/// (e.g., processing `a.b.c` before `a.b`). Secondary sort by original index maintains stability.
///
/// # Arguments
/// * `paths_str` - A comma-separated list of dotted paths (e.g., "a.b.c,x.y.z").
/// * `values_str` - A comma-separated list of values corresponding to the paths.
///
/// # Returns
/// * `Ok(Vec<UpdateItem>)` - A vector of validated update items, sorted appropriately.
/// * `Err(String)` - An error message if parsing or validation fails.
fn prepare_updates<'a>(paths_str: &'a str, values_str: &str) -> Result<Vec<UpdateItem<'a>>, String> {
  let path_list = split_comma_separated_str(paths_str);
  let value_list = split_comma_separated_str(values_str);

  if path_list.len() != value_list.len() {
    return Err("Number of paths must match number of values".to_string());
  }

  // Collect results and check for initial parsing/validation errors.
  // Using collect into Result handles potential errors during mapping.
  let mut updates: Vec<UpdateItem> = path_list
    .iter()
    .enumerate()
    .map(|(i, &path)| {
      let value_str = value_list[i]; // Safe due to initial length check
      // Convert path parts to owned Strings
      let path_parts = path.split('.').collect::<Vec<&str>>();

      // Validate that the path isn't empty and doesn't contain empty segments (e.g., "a..b").
      if path_parts.is_empty() || path_parts.iter().any(|s| s.is_empty()) {
        Err(format!("Path at index {} ('{}') is invalid or contains empty segments", i, path))
      } else {
        let parsed_value = parse_value(value_str);
        Ok(UpdateItem { original_index: i, path_parts, value_to_insert: parsed_value })
      }
    })
    .collect::<Result<Vec<_>, String>>()?;

  // Sort updates: longest paths first, preserving original order for ties.
  // This sorting strategy prevents conflicts when creating nested structures.
  sort_updates(&mut updates);

  Ok(updates)
}

/// This function handles the core logic of applying a single update item to the TOML document.
/// It navigates the document based on the `path_parts`, potentially creating tables implicitly,
/// and sets the final key to the `value_to_insert`.
/// It deals with various existing structures at the target path:
///   - If it finds a `Value`, it updates it directly.
///   - If it finds a `Table` or `ArrayOfTables`, it removes the existing item and proceeds
///     as if the path was initially empty, ensuring the final segment becomes a `Value`.
///   - If the path (or parts of it) doesn't exist, it creates the necessary `Table` structures.
///
/// # Arguments
/// * `doc` - A mutable reference to the `toml_edit::Document` to modify.
/// * `item` - The `UpdateItem` containing the path and value to apply (consumed).
///
/// # Returns
/// * `Ok(())` - If the update was applied successfully (either updating or creating).
/// * `Err(String)` - An error message if the update fails (e.g., path conflict).
fn apply_single_update_to_doc(
  doc: &mut DocumentMut,
  path_parts: &[&str],
  value_to_insert: Option<Value>,
) -> Result<(), String> {
  if path_parts.is_empty() {
    return Err("Cannot apply update with an empty path".to_string());
  }

  match value_to_insert {
    Some(value_to_insert) => {
      let direct_item = get_item_at_path_mut(doc, path_parts);
      match direct_item {
        Some(Item::Value(value)) => {
          *value = value_to_insert;
        }
        Some(Item::Table(_)) | Some(Item::ArrayOfTables(_)) => {
          // If the target path points to a Table or ArrayOfTables, but we need to insert a Value,
          // we must remove the existing structure first. We get the parent table and remove the item.
          // The loop will then reiterate, hitting the `None` case below to insert the value correctly.
          let mut parent_path = path_parts.to_vec();
          parent_path.pop(); // Safe because path_parts is not empty
          let parent_item = get_item_at_path_mut(doc, &parent_path);
          if let Some(parent_item) = parent_item.and_then(Item::as_table_like_mut) {
            parent_item.remove(path_parts[path_parts.len() - 1]);
          }
          // this will try again and should hit the None case below
          return apply_single_update_to_doc(doc, path_parts, Some(value_to_insert));
        }
        Some(_) => {}
        None => {
          // The path doesn't exist or was cleared in a previous iteration.
          // Create the necessary structure and insert the value.
          match path_parts {
            [] => {
              // This case should theoretically not be hit due to the initial check,
              // but handle it defensively.
            }
            [key] => {
              // Path has only one part, insert directly into the root table.
              simple_table_insertion(doc, &[], key, value_to_insert);
            }
            [parents @ .., key] => {
              // Path has multiple parts. Determine if we can use dotted keys
              // or need to create full nested tables.
              let parent_path_item = get_item_at_path_mut(doc, parents);
              match parent_path_item {
                None | Some(Item::None) | Some(Item::ArrayOfTables(_)) => {
                  // Parent path doesn't exist, is None, or is an ArrayOfTables.
                  // We generally need to create a new table structure.
                  match path_parts {
                    // Check grandparent to see if we can attach using a dotted key.
                    [_, key] => {
                      // No grandparent (parent is root)
                      simple_table_insertion(doc, parents, key, value_to_insert);
                    }
                    [grandparents @ .., parent, key] => {
                      let grandparent_path_item = get_item_at_path_mut(doc, grandparents);
                      match grandparent_path_item {
                        Some(Item::Table(grandparent_path_table)) => {
                          // Grandparent is a Table. We can insert `parent.key = value` as a dotted key table.
                          // This avoids creating a full `[parent]` table if possible.
                          let mut new_table = Table::new();
                          new_table.set_dotted(true);
                          new_table.insert(key, Item::Value(value_to_insert));

                          grandparent_path_table.insert(parent, Item::Table(new_table));
                        }
                        _ => {
                          // Grandparent is not a suitable table (or doesn't exist).
                          // Fall back to creating standard nested tables.
                          simple_table_insertion(doc, parents, key, value_to_insert);
                        }
                      }
                    }
                    _ => {
                      // Should be unreachable due to path_parts structure.
                      unreachable!("Invalid path structure encountered in apply_single_update_to_doc")
                    }
                  }
                }
                Some(Item::Value(_)) | Some(Item::Table(_)) => {
                  // Parent path exists and is a Value or Table.
                  // We can likely insert directly into the parent table structure.
                  // simple_table_insertion handles overwriting a Value with a Table if needed.
                  simple_table_insertion(doc, parents, key, value_to_insert);
                }
              }
            }
          }
        }
      }
      Ok(())
    }
    None => {
      delete_item_at_path(doc, path_parts);
      Ok(())
    }
  }
}

fn delete_item_at_path(doc: &mut DocumentMut, path_parts: &[&str]) {
  if path_parts.is_empty() {
    return;
  }

  let mut parent_parts = path_parts.to_vec();
  parent_parts.pop();
  let parent_item = get_item_at_path_mut(doc, &parent_parts);
  match parent_item {
    Some(Item::Table(table)) => {
      table.remove(path_parts[path_parts.len() - 1]);
    }
    _ => {
      // if the parent isn't there, or can't hold a child entry => neither is the child, and nothing to do.
    }
  }
}

/// Parses a string slice into a `toml_edit::Value`.
/// It attempts to parse as boolean, integer, and float (in that order).
/// If none of these succeed, it treats the input as a TOML string value.
/// Preserves original whitespace if interpreted as a string.
fn parse_value(value_str: &str) -> Option<Value> {
  // Trim whitespace for boolean/numeric checks, but use original for string value.
  let trimmed_value_str = value_str.trim();

  let item = if trimmed_value_str == "true" {
    value(true)
  } else if trimmed_value_str == "false" {
    value(false)
  } else if trimmed_value_str == "$undefined" {
    return None;
  } else if let Ok(int_val) = trimmed_value_str.parse::<i64>() {
    value(int_val)
  } else if let Ok(float_val) = trimmed_value_str.parse::<f64>() {
    value(float_val)
  } else {
    // Default to string, using the original untrimmed string.
    value(value_str.to_string())
  };

  // The `value()` function returns an `Item`. We need to extract the `Value` from it.
  Some(
    item
      .as_value()
      .expect("Internal error: `value()` function should always produce an Item::Value variant")
      .to_owned(),
  )
}

/// Represents a single update operation derived from the input strings.
#[derive(Debug, Clone)]
struct UpdateItem<'a> {
  original_index: usize,          // Used for stable sorting if path lengths are equal
  path_parts: Vec<&'a str>,       // The path split into components
  value_to_insert: Option<Value>, // The parsed TOML value to insert
}

/// Sorts update items: longest path first, then by original index for stability.
fn sort_updates(updates: &mut Vec<UpdateItem>) {
  updates.sort_by(|a, b| {
    // Primary key: path length (reversed for longest first)
    b.path_parts.len().cmp(&a.path_parts.len())
        // Secondary key: original index (for stability)
        .then_with(|| a.original_index.cmp(&b.original_index))
  });
}

/// Recursively navigates the document structure using the provided path parts.
/// Returns a mutable reference `Some(&mut Item)` if the path leads to an existing item,
/// `None` otherwise. An empty `path_parts` slice refers to the root document item itself.
fn get_item_at_path_mut<'a>(doc: &'a mut DocumentMut, path_parts: &[&str]) -> Option<&'a mut Item> {
  let mut current_item: &mut Item = doc.as_item_mut();

  for part in path_parts {
    match current_item.as_table_like_mut() {
      Some(table_like) => {
        match table_like.get_mut(part) {
          Some(next_item) => current_item = next_item,
          None => return None, // Path segment not found
        }
      }
      None => return None, // Cannot traverse into a non-table-like item (e.g., value, array)
    }
  }
  Some(current_item)
}

/// Inserts a value into the document using a potentially nested path.
/// This function ensures that all necessary parent tables along the `parents` path exist,
/// creating them as implicit tables if they don't. Finally, it inserts the `key` with `to_set`
/// into the table identified by the `parents` path.
/// It handles overwriting existing *values* at intermediate paths by replacing them with tables.
fn simple_table_insertion(doc: &mut DocumentMut, parents: &[&str], key: &str, to_set: Value) {
  let mut current_table = doc.as_table_mut(); // Start from the root table

  for part in parents {
    // Ensure the current part exists and is a table.
    // If it exists but isn't a table (e.g., it's a value), it will be replaced.
    // If it doesn't exist, a new implicit table is created.
    if !current_table.contains_key(part) || !current_table[part].is_table() {
      let mut new_table = toml_edit::Table::new();
      new_table.set_implicit(true);
      current_table.insert(part, Item::Table(new_table));
    }
    // Now, get the mutable reference to the table for this part.
    // We expect this to succeed because we either found it or just created it.
    current_table =
      current_table.get_mut(part).and_then(Item::as_table_mut).expect("Should be a table after check/insert");
  }
  // After iterating through parents, 'current_table' is the direct parent for the final key.
  current_table.insert(key, Item::Value(to_set));
}

#[cfg(test)]
mod tests {
  use super::*;

  fn test_update_toml_values(input: &str, paths: &str, values: &str, expected: &str) {
    let result = update_toml_values(input, paths, values).expect("Failed to update TOML");
    let expected_doc = DocumentMut::from_str(expected).unwrap();
    let result_doc = DocumentMut::from_str(&result).unwrap();
    assert_eq!(expected_doc.to_string(), result_doc.to_string());
  }

  #[test]
  fn test_echo_toml() {
    let input = r#"
[test]
key = "value"
"#;
    let output = echo_toml(input).expect("Failed to parse valid TOML");

    // TOML parser might reformat slightly, so use Document for comparison
    let parsed_input = DocumentMut::from_str(input).unwrap();
    let parsed_output = DocumentMut::from_str(&output).unwrap();
    assert_eq!(parsed_input.to_string(), parsed_output.to_string());
  }

  #[test]
  fn test_echo_toml_invalid() {
    let input = "invalid toml";
    let result = echo_toml(input);
    assert!(result.is_err());
  }

  #[test]
  fn test_empty_file_single_item() {
    test_update_toml_values(r#""#, "a", "1", r#"a = 1"#);
  }

  #[test]
  fn test_empty_file_double_item() {
    test_update_toml_values(
      r#""#,
      "a.b",
      "1",
      r#"[a]
b = 1
"#,
    );
  }

  #[test]
  fn test_uses_single_dot_if_space_for_it() {
    test_update_toml_values(
      r#"
[a]
b = 1
"#,
      "a.c.d",
      "2",
      r#"
[a]
b = 1
c.d = 2
"#,
    );
  }

  #[test]
  fn test_does_not_use_dots_if_no_home_for_it() {
    test_update_toml_values(
      r#"
[a]
b = 1
"#,
      "a.c.d.e",
      "2",
      r#"
[a]
b = 1

[a.c.d]
e = 2
"#,
    );
  }

  #[test]
  fn test_update_toml_basic_updates_existing() {
    test_update_toml_values(
      r#"
[section]
key = "old_value"
other = 123
"#,
      "section.key",
      "new_value",
      r#"
[section]
key = "new_value"
other = 123
"#,
    );
  }

  #[test]
  fn test_update_toml_add_new() {
    test_update_toml_values(
      r#"
[section]
existing = true
"#,
      "section.new_key",
      "42",
      r#"
[section]
existing = true
new_key = 42
"#,
    );
  }

  #[test]
  fn test_update_toml_nested() {
    test_update_toml_values(
      r#"
[parent]
"#,
      "parent.child.grandchild",
      "true",
      r#"
[parent]
child.grandchild = true
"#,
    );
  }

  #[test]
  fn test_update_toml_multiple() {
    test_update_toml_values(
      r#"
[section1]
key1 = "value1"

[section2]
key2 = 42
"#,
      "section1.key1,section2.key2,section3.new",
      "updated,99,3.14",
      r#"
[section1]
key1 = "updated"

[section2]
key2 = 99

[section3]
new = 3.14
"#,
    );
  }

  #[test]
  fn test_update_toml_types() {
    test_update_toml_values(
      r#"
[test]
"#,
      "test.string,test.int,test.float,test.bool",
      "hello,123,45.67,true",
      r#"
[test]
string = "hello"
int = 123
float = 45.67
bool = true
"#,
    );
  }

  #[test]
  fn test_adds_new_entry_to_existing_table() {
    test_update_toml_values(
      r#"
[section]
foo = 1
"#,
      "section.new_key",
      "42",
      r#"
[section]
foo = 1
new_key = 42
"#,
    );
  }

  #[test]
  fn test_creates_new_table_if_needed_and_likes_dots() {
    test_update_toml_values(
      r#"
[section]
foo = 1

[keep.this]
thing = true
"#,
      "section.subsection.new_key,section.subsection.something.else.here",
      "42,43",
      r#"
[section]
foo = 1

[section.subsection]
new_key = 42

[section.subsection.something.else]
here = 43

[keep.this]
thing = true
"#,
    );
  }

  #[test]
  fn test_creates_minimal_new_tables() {
    test_update_toml_values(
      r#"
[foo]
existing = 1
"#,
      "foo.bar.aaa,foo.bar.bbb,foo.bar.ccc.ddd",
      "1,2,3",
      r#"
[foo]
existing = 1

[foo.bar]
aaa = 1
bbb = 2

[foo.bar.ccc]
ddd = 3
"#,
    );
  }

  #[test]
  fn test_replaces_table_if_setting_a_value() {
    test_update_toml_values(
      r#"
[a.b.c]
d = 1
"#,
      "a.b",
      "1",
      r#"[a]
b = 1
"#,
    );
  }

  #[test]
  fn test_replaces_table_if_setting_a_value_with_no_parent() {
    test_update_toml_values(
      r#"
[a]
d = 1
"#,
      "a",
      "1",
      r#"a = 1"#,
    );
  }

  #[test]
  fn test_replaces_array_of_table_if_setting_a_value() {
    test_update_toml_values(
      r#"
[[a.b.c]]
d = 1
"#,
      "a.b.c",
      "1",
      r#"[a.b]
c = 1
"#,
    );
  }

  #[test]
  fn test_inserts_into_document_root_if_new() {
    test_update_toml_values(
      r#"
[a]
b = 1
"#,
      "c",
      "1",
      r#"c = 1

[a]
b = 1
"#,
    );
  }

  #[test]
  fn test_replaces_if_parent_is_currently_a_value() {
    test_update_toml_values(
      r#"
[a]
b = 1
"#,
      "a.b.c",
      "1",
      r#"
[a]

[a.b]
c = 1
"#,
    );
  }

  #[test]
  fn test_adds_as_dotted_if_grandparent_is_a_table() {
    test_update_toml_values(
      r#"
[a]
d = 1
"#,
      "a.b.c",
      "1",
      r#"
[a]
d = 1
b.c = 1
"#,
    );
  }

  #[test]
  fn test_attaches_to_the_right_thing() {
    test_update_toml_values(
      r#"
[a.b.c]
existing = 1
"#,
      "a.b.c.new",
      "1",
      r#"
[a.b.c]
existing = 1
new = 1
"#,
    );
  }

  #[test]
  fn test_does_minimal_updates_attaching_to_existing_tables() {
    test_update_toml_values(
      r#"
[foo.a.b.c.d.e]
existing = 1
"#,
      "foo.a.b.c.d.e.f.g,foo.a.b.c.d.e.f.h,foo.a.b.c.d.e.f.i.j",
      "1,2,3",
      r#"
[foo.a.b.c.d.e]
existing = 1

[foo.a.b.c.d.e.f]
g = 1
h = 2

[foo.a.b.c.d.e.f.i]
j = 3
"#,
    );
  }

  #[test]
  fn test_removes_value_if_setting_to_undefined() {
    test_update_toml_values(
      r#"
      [section]
      key = "value"
      "#,
      "section.key",
      "$undefined",
      r#"
      [section]
      "#,
    );
  }

  #[test]
  fn test_removes_value_from_document_if_setting_to_undefined() {
    test_update_toml_values(
      r#"
      key = "value"
      "#,
      "key",
      "$undefined",
      r#"      "#,
    );
  }

  #[test]
  fn test_does_nothing_if_removing_something_that_does_not_exist() {
    test_update_toml_values(
      r#"
      [section]
      "#,
      "key",
      "$undefined",
      r#"
      [section]
      "#,
    );
  }

  /// Test that comments are preserved when updating TOML files.
  ///
  /// Note on `toml_edit` comment preservation behavior:
  /// - Comments attached to structures (tables, arrays) and sections are generally preserved.
  /// - Comments attached to key-value pairs:
  ///   - Leading comments (immediately above the key) are preserved.
  ///   - Inline comments (on the same line, after the value) are typically *lost* when the value is replaced.
  ///   - Comments on untouched key-value pairs remain untouched.
  /// - Blank lines and other formatting might be adjusted by `toml_edit` during parsing and serialization.
  #[test]
  fn test_preserves_comments() {
    test_update_toml_values(
      r#"
# This is a top comment
[section] # Comment after section header
# Comment before key
key = "value" # Comment after value - this comment will be lost when key is updated
untouched = 123 # This comment will be preserved

# Comment before another section
[another] # Another section comment
foo = 42 # Number comment
"#,
      "section.key,another.bar",
      "updated,true",
      r#"
# This is a top comment
[section] # Comment after section header
# Comment before key
key = "updated"
untouched = 123 # This comment will be preserved

# Comment before another section
[another] # Another section comment
foo = 42 # Number comment
bar = true
"#,
    );
  }

  #[test]
  fn test_sort_updates_empty() {
    let mut updates: Vec<UpdateItem> = vec![];
    sort_updates(&mut updates);
    assert!(updates.is_empty());
  }

  #[test]
  fn test_sort_updates_single_item() {
    let mut updates = vec![UpdateItem {
      original_index: 0,
      path_parts: vec!["a", "b"],
      value_to_insert: Some(value(1).as_value().unwrap().to_owned()),
    }];
    sort_updates(&mut updates);
    assert_eq!(updates.len(), 1);
    assert_eq!(updates[0].path_parts, vec!["a", "b"]);
  }
}
