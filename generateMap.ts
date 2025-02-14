import type { WorldMap } from "hytopia";
import { Vector3 } from "hytopia";
import { BlOCK_SPAWN_LOCATIONS } from "./dirtBlocks/DirtCordinates";

// Enhanced noise function for more varied terrain
function noise(x: number, z: number): number {
    const baseNoise = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 2;
    const detailNoise = Math.sin(x * 0.4) * Math.cos(z * 0.3) * 1.5;
    const mountainNoise = Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.05)) * 8;
    return baseNoise + detailNoise + mountainNoise;
}

// Helper function to create a flat area of blocks
export function createFlatArea(width: number, depth: number, baseHeight: number = 0): Record<string, number> {
    const blocks: Record<string, number> = {};
    
    for (let x = -width/2; x < width/2; x++) {
        for (let z = -depth/2; z < depth/2; z++) {
            // Add stone base
            blocks[`${x},${baseHeight},${z}`] = 1;
            // Add grass top
            blocks[`${x},${baseHeight + 1},${z}`] = 2;
        }
    }
    
    return blocks;
}

export function generateMap(): WorldMap {
    const blocks: Record<string, number> = {};
    const WORLD_SIZE = 100;
    const FLAT_AREA_SIZE = 30; // Size of flat area around spawn
    const FLAT_AREA_HEIGHT = 15; // Height of the flat area
    const proceduralSpawnPoints: Vector3[] = [];
    const MAX_PROCEDURAL_SPAWNS = 20;
    
    // Generate terrain
    for (let x = -WORLD_SIZE/2; x < WORLD_SIZE/2; x++) {
        for (let z = -WORLD_SIZE/2; z < WORLD_SIZE/2; z++) {
            // Check if we're in the flat spawn area
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            let height: number;
            
            if (distanceFromCenter < FLAT_AREA_SIZE) {
                // Flat spawn area
                height = FLAT_AREA_HEIGHT;
                
                // Optional: Create a gentle slope at the edges of the flat area
                if (distanceFromCenter > FLAT_AREA_SIZE - 5) {
                    const transitionFactor = (distanceFromCenter - (FLAT_AREA_SIZE - 5)) / 5;
                    const noiseHeight = Math.floor(noise(x, z)) + 4;
                    height = Math.floor(FLAT_AREA_HEIGHT * (1 - transitionFactor) + noiseHeight * transitionFactor);
                }
            } else {
                // Regular noise-based terrain for outer areas
                height = Math.floor(noise(x, z)) + 4;
            }
            
            // Generate terrain layers
            for (let y = 0; y <= height; y++) {
                const blockType = y === height ? 2 : 1; // Grass on top, stone below
                blocks[`${x},${y},${z}`] = blockType;


            }
        }
    }

    return {
        blockTypes: [
            { id: 1, name: "stone", textureUri: "blocks/stone.png" },
            { id: 2, name: "grass", textureUri: "blocks/grass" }
        ],
        blocks
    };
}