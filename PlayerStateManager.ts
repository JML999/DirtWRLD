import { Entity, Player, World } from 'hytopia';

export type PlayerState = {
    dirt: number;
    kingScore: number;
};

// First, define our state manager
export class PlayerStateManager {

    private states: Map<Player, PlayerState> = new Map();

    constructor(
    ) {}

    initializePlayer(player: Player) {
        this.states.set(player, {
            dirt: 0,
            kingScore: 0
        });
    }

    addDirtPoints(player: Player, points: number) {
        console.log('addDirtPoints', points);
        const state = this.states.get(player);
        if (state) {
            console.log('state', state);
            state.dirt += points;
            console.log('state.dirt', state.dirt);
            // Send updated points to client
            player.ui.sendData({
                type: 'dirtPoints',
                points: state.dirt
            });
        }
    }

    getState(player: Player) {
        return this.states.get(player);
    }

    cleanup(player: Player) {
        this.states.delete(player);
    }

}
