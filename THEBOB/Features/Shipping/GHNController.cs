using Microsoft.AspNetCore.Mvc;
using THEBOB.Services;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/ghn")]
    public class GHNController : ControllerBase
    {
        private readonly IGhnService _ghn;
        public GHNController(IGhnService ghn) => _ghn = ghn;

        [HttpGet("provinces")]
        public async Task<IActionResult> GetProvinces()
        {
            var result = await _ghn.GetProvincesAsync();
            return Ok(result);
        }

        [HttpGet("districts/{provinceId}")]
        public async Task<IActionResult> GetDistricts(int provinceId)
        {
            var result = await _ghn.GetDistrictsAsync(provinceId);
            return Ok(result);
        }

        [HttpGet("wards/{districtId}")]
        public async Task<IActionResult> GetWards(int districtId)
        {
            var result = await _ghn.GetWardsAsync(districtId);
            return Ok(result);
        }

        [HttpPost("fee")]
        public async Task<IActionResult> CalculateFee([FromBody] GhnFeeRequest req)
        {
            var result = await _ghn.CalculateFeeAsync(req);
            return Ok(new { data = new { total = result.Total } });
        }
    }
}