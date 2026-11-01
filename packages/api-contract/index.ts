import * as path from 'path';

export const API_VERSION = '1.2.0-draft';
export const OPENAPI_SPEC_FILENAME = 'openapi.yaml';
export const OPENAPI_SPEC_PATH = path.resolve(__dirname, OPENAPI_SPEC_FILENAME);

export interface ApiContractMetadata {
  title: string;
  version: string;
  totalEndpoints: number;
  proposedExtensionEndpoints: number;
  basePath: string;
}

export const API_CONTRACT_METADATA: ApiContractMetadata = {
  title: 'Campus Marketplace API',
  version: API_VERSION,
  totalEndpoints: 49,
  proposedExtensionEndpoints: 14,
  basePath: '/api/v1',
};
