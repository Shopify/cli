/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any, tsdoc/syntax, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries  */
import {JsonMapType} from '@shopify/cli-kit/node/toml'
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /**
   * An Amazon Web Services Amazon Resource Name (ARN), including the Region and account ID.
   * For more information, refer to [Amazon Resource Names](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html).
   */
  ARN: { input: any; output: any; }
  /**
   * Represents non-fractional signed whole numeric values. Since the value may
   * exceed the size of a 32-bit integer, it's encoded as a string.
   */
  BigInt: { input: any; output: any; }
  /**
   * A string containing a hexadecimal representation of a color.
   *
   * For example, "#6A8D48".
   */
  Color: { input: any; output: any; }
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date string.
   * For example, September 7, 2019 is represented as `"2019-07-16"`.
   */
  Date: { input: any; output: any; }
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: { input: any; output: any; }
  /**
   * A signed decimal number, which supports arbitrary precision and is serialized as a string.
   *
   * Example values: `"29.99"`, `"29.999"`.
   */
  Decimal: { input: any; output: any; }
  /**
   * A string containing a strict subset of HTML code. Non-allowed tags will be stripped out.
   * Allowed tags:
   * * `a` (allowed attributes: `href`, `target`)
   * * `b`
   * * `br`
   * * `em`
   * * `i`
   * * `strong`
   * * `u`
   * Use [HTML](https://shopify.dev/api/admin-graphql/latest/scalars/HTML) instead if you need to
   * include other HTML tags.
   *
   * Example value: `"Your current domain is <strong>example.myshopify.com</strong>."`
   */
  FormattedString: { input: any; output: any; }
  /**
   * A string containing HTML code. Refer to the [HTML spec](https://html.spec.whatwg.org/#elements-3) for a
   * complete list of HTML elements.
   *
   * Example value: `"<p>Grey cotton knit sweater.</p>"`
   */
  HTML: { input: any; output: any; }
  /**
   * A [JSON](https://www.json.org/json-en.html) object.
   *
   * Example value:
   * `{
   *   "product": {
   *     "id": "gid://shopify/Product/1346443542550",
   *     "title": "White T-shirt",
   *     "options": [{
   *       "name": "Size",
   *       "values": ["M", "L"]
   *     }]
   *   }
   * }`
   */
  JSON: { input: JsonMapType | string; output: JsonMapType; }
  /** A monetary value string without a currency symbol or code. Example value: `"100.57"`. */
  Money: { input: any; output: any; }
  /** A scalar value. */
  Scalar: { input: any; output: any; }
  /**
   * Represents a unique identifier in the Storefront API. A `StorefrontID` value can
   * be used wherever an ID is expected in the Storefront API.
   *
   * Example value: `"Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0LzEwMDc5Nzg1MTAw"`.
   */
  StorefrontID: { input: any; output: any; }
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: { input: string; output: string; }
  /**
   * An unsigned 64-bit integer. Represents whole numeric values between 0 and 2^64 - 1 encoded as a string of base-10 digits.
   *
   * Example value: `"50"`.
   */
  UnsignedInt64: { input: any; output: any; }
  /**
   * Time between UTC time and a location's observed time, in the format `"+HH:MM"` or `"-HH:MM"`.
   *
   * Example value: `"-07:00"`.
   */
  UtcOffset: { input: any; output: any; }
};

/**
 * The possible HTTP methods that can be used when sending a request to upload a file using information from a
 * [StagedMediaUploadTarget](https://shopify.dev/api/admin-graphql/latest/objects/StagedMediaUploadTarget).
 */
export type StagedUploadHttpMethodType =
  /** The POST HTTP method. */
  | 'POST'
  /** The PUT HTTP method. */
  | 'PUT';

/** The input fields for generating staged upload targets. */
export type StagedUploadInput = {
  /**
   * The size of the file to upload, in bytes. This is required when the request's resource property is set to
   * [VIDEO](https://shopify.dev/api/admin-graphql/latest/enums/StagedUploadTargetGenerateUploadResource#value-video)
   * or [MODEL_3D](https://shopify.dev/api/admin-graphql/latest/enums/StagedUploadTargetGenerateUploadResource#value-model3d).
   */
  fileSize?: InputMaybe<Scalars['UnsignedInt64']['input']>;
  /** The file's name and extension. */
  filename: Scalars['String']['input'];
  /**
   * The HTTP method to be used when sending a request to upload the file using the returned staged
   * upload target.
   */
  httpMethod?: InputMaybe<StagedUploadHttpMethodType>;
  /** The file's MIME type. */
  mimeType: Scalars['String']['input'];
  /** The file's intended Shopify resource type. */
  resource: StagedUploadTargetGenerateUploadResource;
};

/** The resource type to receive. */
export type StagedUploadTargetGenerateUploadResource =
  /**
   * Represents bulk mutation variables.
   *
   * For example, bulk mutation variables can be used for bulk operations using the
   * [bulkOperationRunMutation mutation](https://shopify.dev/api/admin-graphql/latest/mutations/bulkOperationRunMutation).
   */
  | 'BULK_MUTATION_VARIABLES'
  /**
   * An image associated with a collection.
   *
   * For example, after uploading an image, you can use the
   * [collectionUpdate mutation](https://shopify.dev/api/admin-graphql/latest/mutations/collectionUpdate)
   * to add the image to a collection.
   */
  | 'COLLECTION_IMAGE'
  /**
   * Represents any file other than HTML.
   *
   * For example, after uploading the file, you can add the file to the
   * [Files page](https://shopify.com/admin/settings/files) in Shopify admin using the
   * [fileCreate mutation](https://shopify.dev/api/admin-graphql/latest/mutations/fileCreate).
   */
  | 'FILE'
  /**
   * An image.
   *
   * For example, after uploading an image, you can add the image to a product using the
   * [productCreateMedia mutation](https://shopify.dev/api/admin-graphql/latest/mutations/productCreateMedia)
   * or to the [Files page](https://shopify.com/admin/settings/files) in Shopify admin using the
   * [fileCreate mutation](https://shopify.dev/api/admin-graphql/latest/mutations/fileCreate).
   */
  | 'IMAGE'
  /**
   * A Shopify hosted 3d model.
   *
   * For example, after uploading the 3d model, you can add the 3d model to a product using the
   * [productCreateMedia mutation](https://shopify.dev/api/admin-graphql/latest/mutations/productCreateMedia).
   */
  | 'MODEL_3D'
  /**
   * An image that's associated with a product.
   *
   * For example, after uploading the image, you can add the image to a product using the
   * [productCreateMedia mutation](https://shopify.dev/api/admin-graphql/latest/mutations/productCreateMedia).
   */
  | 'PRODUCT_IMAGE'
  /**
   * Represents a label associated with a return.
   *
   * For example, once uploaded, this resource can be used to [create a
   * ReverseDelivery](https://shopify.dev/api/admin-graphql/unstable/mutations/reverseDeliveryCreateWithShipping).
   */
  | 'RETURN_LABEL'
  /**
   * An image.
   *
   * For example, after uploading the image, you can add the image to the
   * [Files page](https://shopify.com/admin/settings/files) in Shopify admin using the
   * [fileCreate mutation](https://shopify.dev/api/admin-graphql/latest/mutations/fileCreate).
   */
  | 'SHOP_IMAGE'
  /**
   * Represents a redirect CSV file.
   *
   * Example usage: This resource can be used for creating a
   * [UrlRedirectImport](https://shopify.dev/api/admin-graphql/2022-04/objects/UrlRedirectImport)
   * object for use in the
   * [urlRedirectImportCreate mutation](https://shopify.dev/api/admin-graphql/latest/mutations/urlRedirectImportCreate).
   */
  | 'URL_REDIRECT_IMPORT'
  /**
   * A Shopify-hosted video.
   *
   * For example, after uploading the video, you can add the video to a product using the
   * [productCreateMedia mutation](https://shopify.dev/api/admin-graphql/latest/mutations/productCreateMedia)
   * or to the [Files page](https://shopify.com/admin/settings/files) in Shopify admin using the
   * [fileCreate mutation](https://shopify.dev/api/admin-graphql/latest/mutations/fileCreate).
   */
  | 'VIDEO';
