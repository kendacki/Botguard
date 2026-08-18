// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title VerificationPass
/// @notice Soulbound ERC-721 issued 1:1 with a wallet after a successful BOTGUARD
///         verification. Token id is derived from the holder address so each wallet
///         can ever own one pass. Metadata records the verification kind (tier +
///         jurisdiction) on chain; no personal data is stored.
contract VerificationPass is Ownable, IERC165 {
    error Soulbound();
    error NotMinter();
    error InvalidTier();
    error ZeroAddress();
    error PassNotFound();
    error NotOwner();

    enum InvestorTier {
        NONE,
        RETAIL,
        ACCREDITED,
        INSTITUTIONAL
    }

    struct Pass {
        InvestorTier tier;
        bytes2 jurisdiction;
        uint64 issuedAt;
        uint64 expiresAt;
        bool revoked;
    }

    string public constant name = "BOTGUARD Verification Pass";
    string public constant symbol = "BGV";

    address public minter;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => Pass) public passes;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event PassIssued(
        address indexed holder,
        uint256 indexed tokenId,
        InvestorTier tier,
        bytes2 jurisdiction,
        uint64 expiresAt
    );
    event PassRevoked(address indexed holder, uint256 indexed tokenId);

    modifier onlyMinter() {
        if (msg.sender != minter && msg.sender != owner()) revert NotMinter();
        _;
    }

    constructor(address initialOwner, address initialMinter) Ownable(initialOwner) {
        if (initialMinter == address(0)) revert ZeroAddress();
        minter = initialMinter;
    }

    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) revert ZeroAddress();
        emit MinterUpdated(minter, newMinter);
        minter = newMinter;
    }

    function tokenIdOf(address holder) public pure returns (uint256) {
        return uint256(uint160(holder));
    }

    function issuePass(
        address holder,
        uint8 tier,
        bytes2 jurisdiction,
        uint64 expiresAt
    ) external onlyMinter returns (uint256 tokenId) {
        if (holder == address(0)) revert ZeroAddress();
        if (tier < uint8(InvestorTier.RETAIL) || tier > uint8(InvestorTier.INSTITUTIONAL)) {
            revert InvalidTier();
        }

        tokenId = tokenIdOf(holder);
        passes[tokenId] = Pass({
            tier: InvestorTier(tier),
            jurisdiction: jurisdiction,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });

        if (_owners[tokenId] == address(0)) {
            _owners[tokenId] = holder;
            _balances[holder] += 1;
            emit Transfer(address(0), holder, tokenId);
        }

        emit PassIssued(holder, tokenId, InvestorTier(tier), jurisdiction, expiresAt);
    }

    function revokePass(address holder) external onlyMinter {
        uint256 tokenId = tokenIdOf(holder);
        address current = _owners[tokenId];
        if (current == address(0)) revert PassNotFound();
        passes[tokenId].revoked = true;
        delete _owners[tokenId];
        _balances[current] -= 1;
        emit Transfer(current, address(0), tokenId);
        emit PassRevoked(holder, tokenId);
    }

    function hasPass(address holder) public view returns (bool) {
        return _owners[tokenIdOf(holder)] != address(0);
    }

    function passOf(address holder)
        external
        view
        returns (
            uint256 tokenId,
            uint8 tier,
            bytes2 jurisdiction,
            uint64 issuedAt,
            uint64 expiresAt,
            bool exists
        )
    {
        tokenId = tokenIdOf(holder);
        exists = _owners[tokenId] != address(0);
        Pass memory p = passes[tokenId];
        return (tokenId, uint8(p.tier), p.jurisdiction, p.issuedAt, p.expiresAt, exists);
    }

    function balanceOf(address owner_) external view returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner_ = _owners[tokenId];
        if (owner_ == address(0)) revert PassNotFound();
        return owner_;
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f || // ERC721Metadata
            interfaceId == 0x01ffc9a7; // ERC165
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert PassNotFound();
        Pass memory p = passes[tokenId];
        string memory tierName = _tierName(p.tier);
        string memory region = _bytes2ToString(p.jurisdiction);
        string memory wallet = _shortWallet(tokenId);
        string memory svg = _passSvg(tokenId, tierName, region, wallet);
        string memory json = string.concat(
            '{"name":"BOTGUARD ',
            tierName,
            " - ",
            region,
            '","description":"Soulbound BGV badge for one BOT Chain wallet. Tier and region only - no personal data.","background_color":"8A3FFC","attributes":[',
            '{"trait_type":"Tier","value":"',
            tierName,
            '"},',
            '{"trait_type":"Region","value":"',
            region,
            '"},',
            '{"trait_type":"Wallet","value":"',
            wallet,
            '"},',
            '{"trait_type":"Soulbound","value":"true"},',
            '{"trait_type":"Expires","display_type":"date","value":',
            _uToString(uint256(p.expiresAt)),
            "}],",
            '"image":"data:image/svg+xml;base64,',
            _encodeBase64(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", _encodeBase64(bytes(json)));
    }

    function _passSvg(
        uint256 tokenId,
        string memory tierName,
        string memory region,
        string memory wallet
    ) internal pure returns (string memory) {
        uint160 a = uint160(tokenId);
        uint256 x1 = 28 + (uint256(uint8(a >> 152)) % 200);
        uint256 y1 = 18 + (uint256(uint8(a >> 144)) % 70);
        uint256 r1 = 42 + (uint256(uint8(a >> 136)) % 70);
        uint256 x2 = 160 + (uint256(uint8(a >> 128)) % 160);
        uint256 y2 = 210 + (uint256(uint8(a >> 120)) % 90);
        uint256 r2 = 28 + (uint256(uint8(a >> 112)) % 56);
        uint256 x3 = 24 + (uint256(uint8(a >> 104)) % 250);
        uint256 y3 = 268 + (uint256(uint8(a >> 96)) % 56);
        string memory deco = string.concat(
            '<circle cx="',
            _uToString(x1),
            '" cy="',
            _uToString(y1),
            '" r="',
            _uToString(r1),
            '" fill="#C4A6FF" opacity="0.38"/>',
            '<circle cx="',
            _uToString(x2),
            '" cy="',
            _uToString(y2),
            '" r="',
            _uToString(r2),
            '" fill="#5B21B6" opacity="0.28"/>',
            '<circle cx="',
            _uToString(x3),
            '" cy="',
            _uToString(y3),
            '" r="18" fill="#FF5A5F" opacity="0.55"/>'
        );
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360">',
            '<rect width="360" height="360" rx="32" fill="#8A3FFC"/>',
            deco,
            '<rect x="26" y="26" width="308" height="308" rx="24" fill="#F7F6F3"/>',
            '<circle cx="180" cy="132" r="46" fill="#8A3FFC"/>',
            '<circle cx="180" cy="132" r="26" fill="#F7F6F3"/>',
            '<path d="M180 116v16l11 7" fill="none" stroke="#8A3FFC" stroke-width="4" stroke-linecap="round"/>',
            '<text x="180" y="208" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" letter-spacing="2" fill="#8A3FFC">BOTGUARD</text>',
            '<text x="180" y="244" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#1A1A1A">',
            tierName,
            "</text>",
            '<text x="180" y="270" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#6B6B6B">',
            region,
            " - BGV</text>",
            '<text x="180" y="302" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#8A3FFC">',
            wallet,
            "</text>",
            "</svg>"
        );
    }

    function _shortWallet(uint256 tokenId) internal pure returns (string memory) {
        uint160 a = uint160(tokenId);
        return string.concat(
            "0x",
            _hexByte(uint8(a >> 152)),
            _hexByte(uint8(a >> 144)),
            "..",
            _hexByte(uint8(a >> 8)),
            _hexByte(uint8(a))
        );
    }

    function _hexByte(uint8 value) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory out = new bytes(2);
        out[0] = hexChars[value >> 4];
        out[1] = hexChars[value & 15];
        return string(out);
    }

    function _tierName(InvestorTier tier) internal pure returns (string memory) {
        if (tier == InvestorTier.RETAIL) return "Retail";
        if (tier == InvestorTier.ACCREDITED) return "Accredited";
        if (tier == InvestorTier.INSTITUTIONAL) return "Institutional";
        return "None";
    }

    function _bytes2ToString(bytes2 data) internal pure returns (string memory) {
        bytes memory out = new bytes(2);
        out[0] = data[0];
        out[1] = data[1];
        if (out[1] == 0) {
            bytes memory one = new bytes(1);
            one[0] = out[0];
            return string(one);
        }
        return string(out);
    }

    function _uToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _encodeBase64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        uint256 i;
        uint256 j;
        while (i + 3 <= data.length) {
            uint256 n = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8) | uint256(uint8(data[i + 2]));
            result[j] = bytes(table)[(n >> 18) & 63];
            result[j + 1] = bytes(table)[(n >> 12) & 63];
            result[j + 2] = bytes(table)[(n >> 6) & 63];
            result[j + 3] = bytes(table)[n & 63];
            i += 3;
            j += 4;
        }
        if (i < data.length) {
            uint256 n = uint256(uint8(data[i])) << 16;
            if (i + 1 < data.length) n |= uint256(uint8(data[i + 1])) << 8;
            result[j] = bytes(table)[(n >> 18) & 63];
            result[j + 1] = bytes(table)[(n >> 12) & 63];
            result[j + 2] = i + 1 < data.length ? bytes(table)[(n >> 6) & 63] : bytes1("=");
            result[j + 3] = "=";
        }
        return string(result);
    }
}
