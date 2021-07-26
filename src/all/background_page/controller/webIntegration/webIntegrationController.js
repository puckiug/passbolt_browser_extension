/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.4.0
 */

const {ResourceInProgressCacheService} = require("../../service/cache/resourceInProgressCache.service");
const {QuickAccessService} = require("../../service/ui/quickAccess.service");


/**
 * Controller related to the in-form call-to-action
 */
class WebIntegrationController {
  /**
   * WebIntegrationController constructor
   * @param {Worker} worker
   */
  constructor(worker) {
    this.worker = worker;
  }

  /**
   * Request the initial configuration of the in-form menu
   */
  async autosave(resourceToSave) {
    const queryParameters = [
      {name: "uiMode", value: "detached"},
      {name: "feature", value: "autosave-credentials"}
    ];
    // Request username and password
    const resourceInProgress = {
      name: resourceToSave.name,
      uri: new URL(resourceToSave.url).hostname,
      username: resourceToSave.username,
      secret_clear: resourceToSave.password
    };
    ResourceInProgressCacheService.set(resourceInProgress);
    QuickAccessService.openInDetachedMode(queryParameters);
  }
}


exports.WebIntegrationController = WebIntegrationController;
