// Stand-in for lightning/actions, which sfdx-lwc-jest does not ship.
export class CloseActionScreenEvent extends CustomEvent {
    constructor() {
        super("close");
    }
}
