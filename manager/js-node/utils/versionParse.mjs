export default function versionParse(version) {
    const num = Number.parseInt(typeof version === 'string' ? version.replaceAll('.', '') : '0');
    return Number.isNaN(num) ? 0 : num;
}
