import {Abort, Bug} from '../error';
import {
  adminApiEnvironment,
  partnersApiEnvironment,
  storefrontRendererApiEnvironment,
} from '../environment';
import {Environment, Service} from '../network/service';

export function applicationId(service: Service): string {
  switch (service) {
    case Service.AdminApi: {
      const environment = adminApiEnvironment();
      if (environment === Environment.Local) {
        return 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52';
      } else if (environment === Environment.Production) {
        return '7ee65a63608843c577db8b23c4d7316ea0a01bd2f7594f8a9c06ea668c1b775c';
      } else {
        throw new Abort(`Spin is not yet supported for the Shopify Admin API`);
      }
    }
    case Service.PartnersApi: {
      const environment = partnersApiEnvironment();
      if (environment === Environment.Local) {
        return 'df89d73339ac3c6c5f0a98d9ca93260763e384d51d6038da129889c308973978';
      } else if (environment === Environment.Production) {
        return '271e16d403dfa18082ffb3d197bd2b5f4479c3fc32736d69296829cbb28d41a6';
      } else {
        throw new Abort(`Spin is not yet supported for the Partners API`);
      }
    }
    case Service.StorefrontRendererApi: {
      const environment = storefrontRendererApiEnvironment();
      if (environment === Environment.Local) {
        return '46f603de-894f-488d-9471-5b721280ff49';
      } else if (environment === Environment.Production) {
        return 'ee139b3d-5861-4d45-b387-1bc3ada7811c';
      } else {
        throw new Abort(`Spin is not yet supported for the Partners API`);
      }
    }
    default:
      throw new Bug(`Application id for service of type: ${service}`);
  }
}
