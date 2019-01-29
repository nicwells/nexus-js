import Organization from '.';
import {
  ListOrgOptions,
  CreateOrgPayload,
  OrgResponse,
  ListOrgResponse,
  OrgResponseCommon,
  OrgCreatedEvent,
  OrgUpdatedEvent,
  OrgDeprecatedEvent,
  OrgEventListeners,
  OrgEventType,
} from './types';
import { httpPut, httpGet, httpDelete } from '../utils/http';
import { CreateOrganizationException } from './exceptions';
import { PaginatedList } from '../utils/types';
import { getEventSource, parseMessageEventData } from '../utils/events';
// @ts-ignore
import EventSource = require('eventsource');

/**
 *
 * @param label The label of your organization
 * @param name The name of your organization
 */
export async function createOrganization(
  label: string,
  orgPayload?: CreateOrgPayload,
): Promise<Organization> {
  try {
    const orgResponse: OrgResponse = await httpPut(
      `/orgs/${label}`,
      orgPayload,
    );
    return new Organization({ ...orgResponse, ...orgPayload });
  } catch (error) {
    throw new CreateOrganizationException(error.message);
  }
}

/**
 *
 * @param orgLabel The organization label to fetch
 * @param Object<revision, tag> The specific tag OR revision to fetch
 */
export async function getOrganization(
  orgLabel: string,
  options?: { revision?: number; tag?: string },
): Promise<Organization> {
  try {
    // check if we have options
    let ops = '';
    if (options) {
      if (options.revision) {
        ops = `?rev=${options.revision}`;
      }
    }
    const orgResponse: OrgResponse = await httpGet(`/orgs/${orgLabel}${ops}`);
    const org = new Organization(orgResponse);
    return org;
  } catch (error) {
    throw new Error(`ListOrgsError: ${error}`);
  }
}

export async function listOrganizations(
  options?: ListOrgOptions,
): Promise<PaginatedList<Organization>> {
  let ops = '';
  if (options) {
    ops = Object.keys(options).reduce(
      (currentOps, key) =>
        currentOps.length === 0
          ? `?${key}=${encodeURIComponent(options[key])}`
          : `${currentOps}&${key}=${encodeURIComponent(options[key])}`,
      '',
    );
  }
  try {
    const listOrgResponse: ListOrgResponse = await httpGet(`/orgs${ops}`);
    if (listOrgResponse.code || !listOrgResponse._results) {
      return {
        total: 0,
        index: 0,
        results: [],
      };
    }

    const orgs: Organization[] = listOrgResponse._results.map(
      (commonResponse: OrgResponseCommon) =>
        new Organization({
          ...commonResponse,
          '@context': listOrgResponse['@context'],
        }),
    );

    return {
      total: listOrgResponse._total,
      index: (options && options.from) || 1,
      results: orgs,
    };
  } catch (error) {
    throw new Error(error);
  }
}

/**
 *
 * @param orgLabel Current organization label
 * @param rev Last known revision
 * @param newName Knew name the organization will be called with
 */
export async function updateOrganization(
  orgLabel: string,
  rev: number,
  orgPayload: CreateOrgPayload,
): Promise<Organization> {
  try {
    const orgResponse: OrgResponse = await httpPut(
      `/orgs/${orgLabel}?rev=${rev}`,
      orgPayload,
    );
    return new Organization(orgResponse);
  } catch (error) {
    throw new Error(error);
  }
}

/**
 *
 * @param orgLabel Label of the Org to be deprecated
 * @param rev Last know revision
 */
export async function deprecateOrganization(
  orgLabel: string,
  rev: number,
): Promise<Organization> {
  try {
    const orgResponse: OrgResponse = await httpDelete(
      `/orgs/${orgLabel}?rev=${rev}`,
    );
    return new Organization(orgResponse);
  } catch (error) {
    throw new Error(error);
  }
}

export function subscribe(listeners: OrgEventListeners): EventSource {
  const event: EventSource = getEventSource('/orgs/events');

  // set event listeners
  listeners.onOpen && (event.onopen = listeners.onOpen);
  listeners.onError && (event.onerror = listeners.onError);
  listeners.onOrgCreated &&
    event.addEventListener(OrgEventType.OrgCreated, (event: Event) =>
      parseMessageEventData<OrgCreatedEvent>(event as MessageEvent)(
        listeners.onOrgCreated,
      ),
    );
  listeners.onOrgUpdated &&
    event.addEventListener(OrgEventType.OrgUpdated, (event: Event) =>
      parseMessageEventData<OrgUpdatedEvent>(event as MessageEvent)(
        listeners.onOrgUpdated,
      ),
    );
  listeners.onOrgDeprecated &&
    event.addEventListener(OrgEventType.OrgDeprecated, (event: Event) =>
      parseMessageEventData<OrgDeprecatedEvent>(event as MessageEvent)(
        listeners.onOrgDeprecated,
      ),
    );

  return event;
}
