import { httpGet, httpPost } from './utils/http';
import Store from './utils/Store';
import Organization, { ListOrgsResponse, OrgResponse } from './Organization';
import Project from './Project';
import Resource from './Resource';
import ACL from './ACL';

type NexusConfig = {
  environment: string;
  token?: string;
};

export { Organization, Project, Resource, ACL };

export const store: Store = new Store({
  auth: {
    accessToken: null,
  },
  api: {
    baseUrl: null,
  },
});

export default class Nexus {
  constructor(config: NexusConfig) {
    if (!config.environment) {
      throw new Error(
        'No environment provided. Please specify your Nexus instance endpoint.',
      );
    }
    store.update('api', state => ({
      ...state,
      baseUrl: config.environment,
    }));
    if (config.token) {
      store.update('auth', state => ({
        ...state,
        accessToken: config.token,
      }));
    }
  }

  setToken(token: string): void {
    store.update('auth', state => ({
      ...state,
      accessToken: token,
    }));
  }

  removeToken(): void {
    store.update('auth', state => ({
      ...state,
      accessToken: undefined,
    }));
  }

  // TODO: refactor -> blocked by https://github.com/BlueBrain/nexus/issues/112
  async listOrganizations(): Promise<Organization[]> {
    try {
      const listOrgsResponse: ListOrgsResponse = await httpGet('/projects');
      if (listOrgsResponse.code || !listOrgsResponse._results) {
        return [];
      }
      // Get list of unique orgs names
      const filteredOrgNames: string[] = listOrgsResponse._results
        .map(org => {
          const split = org._id.split('/');
          const orgName = split.slice(split.length - 2, split.length - 1)[0];
          return orgName;
        })
        .filter((org, index, self) => self.indexOf(org) === index);

      // get orgs details
      return Promise.all(
        filteredOrgNames.map(async org => await this.getOrganization(org)),
      );
    } catch (e) {
      throw new Error(`ListOrgsError: ${e}`);
    }
  }

  async getOrganization(name: string): Promise<Organization> {
    try {
      const orgResponse: OrgResponse = await httpGet(`/orgs/${name}`);
      const org = new Organization(orgResponse);
      return org;
    } catch (e) {
      throw new Error(`ListOrgsError: ${e}`);
    }
  }
}
