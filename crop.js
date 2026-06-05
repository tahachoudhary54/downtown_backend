import { Jimp } from "jimp";

async function main() {
    console.log("Reading image...");
    try {
        const image = await Jimp.read("../frontend/src/app/favicon.ico");
        console.log("Autocropping...");
        image.autocrop({ tolerance: 0.05 }); // crop out black/empty space
        await image.write("../frontend/src/app/favicon_temp.png");
        console.log("Done!");
    } catch (e) {
        console.error(e);
    }
}
main();
