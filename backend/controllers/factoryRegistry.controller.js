import { registerFactory, getAccessLog, getAllFactories } from "../services/factoryRegistry.service.js";

const register = async (req, res) => {
    try {
        const { factoryName, accessLogAddress } = req.body;
        if (!factoryName || !accessLogAddress) {
            return res.status(400).json({ error: "factoryName and accessLogAddress required" });
        }
        const result = await registerFactory(factoryName, accessLogAddress);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const lookup = async (req, res) => {
    try {
        const { factoryName } = req.params;
        if (!factoryName) return res.status(400).json({ error: "factoryName required" });
        const result = await getAccessLog(factoryName);
        if (result.accessLogAddress === "0x0000000000000000000000000000000000000000") {
            return res.status(404).json({ error: "Factory not registered", factoryName });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const listAll = async (req, res) => {
    try {
        const factories = await getAllFactories();
        res.json({ count: factories.length, factories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { register, lookup, listAll };
