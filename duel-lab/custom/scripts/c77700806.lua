--呪われた稲妻の剣
--Cursed Lightning Sword (original card)
--Link Summon: its own procedure (same on EDOPro and MDPro3) takes face-up "Cursed" monsters you control, plus any
--monster on either field equipped with a "Cursed" Equip Card, which counts as a "Cursed" monster for this Summon.
local s,id=GetID()
local SET_CURSED=0x7c7
local LINK_MIN,LINK_MAX=1,1
function s.initial_effect(c)
	c:EnableReviveLimit()
	local e0=Effect.CreateEffect(c)
	e0:SetType(EFFECT_TYPE_FIELD)
	e0:SetCode(EFFECT_SPSUMMON_PROC)
	e0:SetProperty(EFFECT_FLAG_CANNOT_DISABLE+EFFECT_FLAG_UNCOPYABLE)
	e0:SetRange(LOCATION_EXTRA)
	e0:SetCondition(s.lkcon)
	e0:SetTarget(s.lktg)
	e0:SetOperation(s.lkop)
	e0:SetValue(SUMMON_TYPE_LINK)
	c:RegisterEffect(e0)
	--① (Quick) target 1 face-up monster on the field: equip this card from the field or GY to it
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_EQUIP)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetRange(LOCATION_MZONE+LOCATION_GRAVE)
	e1:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.eqtg)
	e1:SetOperation(s.eqop)
	c:RegisterEffect(e1)
	--② ● the equipped monster is unaffected by activated effects, except those of "Cursed" cards
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_EQUIP)
	e2:SetCode(EFFECT_IMMUNE_EFFECT)
	e2:SetValue(s.immval)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CURSED}
--Link Summon procedure
function s.cursedeq(c)
	return c:IsFaceup() and c:IsSetCard(SET_CURSED)
end
function s.matfilter(c,lc,tp)
	if not (c:IsFaceup() and c:IsCanBeLinkMaterial(lc,tp)) then return false end
	return (c:IsControler(tp) and c:IsSetCard(SET_CURSED)) or c:GetEquipGroup():IsExists(s.cursedeq,1,nil)
end
function s.linkcount(c)
	if c:IsType(TYPE_LINK) and c:GetLink()>1 then return 1+0x10000*c:GetLink() end
	return 1
end
function s.lkgoal(sg,tp,lc)
	return #sg>=LINK_MIN and #sg<=LINK_MAX and sg:CheckWithSumEqual(s.linkcount,lc:GetLink(),#sg,#sg)
		and Duel.GetLocationCountFromEx(tp,tp,sg,lc)>0
end
function s.lkrec(c,tp,sg,mg,lc)
	sg:AddCard(c)
	local res=s.lkgoal(sg,tp,lc) or (#sg<LINK_MAX and mg:IsExists(s.lkrec,1,sg,tp,sg,mg,lc))
	sg:RemoveCard(c)
	return res
end
function s.lkcon(e,c)
	if c==nil then return true end
	local tp=c:GetControler()
	local mg=Duel.GetMatchingGroup(s.matfilter,tp,LOCATION_MZONE,LOCATION_MZONE,nil,c,tp)
	return mg:IsExists(s.lkrec,1,nil,tp,Group.CreateGroup(),mg,c)
end
function s.lktg(e,tp,eg,ep,ev,re,r,rp,chk,c)
	local mg=Duel.GetMatchingGroup(s.matfilter,tp,LOCATION_MZONE,LOCATION_MZONE,nil,c,tp)
	local sg=Group.CreateGroup()
	while #sg<LINK_MAX do
		local cg=mg:Filter(s.lkrec,sg,tp,sg,mg,c)
		if #cg==0 then break end
		local finish=s.lkgoal(sg,tp,c)
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_LMATERIAL)
		local tc=cg:SelectUnselect(sg,tp,finish,#sg==0,LINK_MIN,LINK_MAX)
		if not tc then break end
		if sg:IsContains(tc) then sg:RemoveCard(tc) else sg:AddCard(tc) end
	end
	if #sg>0 and s.lkgoal(sg,tp,c) then
		sg:KeepAlive()
		e:SetLabelObject(sg)
		return true
	end
	return false
end
function s.lkop(e,tp,eg,ep,ev,re,r,rp,c)
	local sg=e:GetLabelObject()
	c:SetMaterial(sg)
	Duel.SendtoGrave(sg,REASON_MATERIAL+REASON_LINK)
	sg:DeleteGroup()
end
--① equip
--equipping affects the monster: one unaffected by this effect cannot be chosen
function s.eqfilter(c,ec,e)
	return c:IsFaceup() and c~=ec and not c:IsImmuneToEffect(e)
end
function s.eqtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	local c=e:GetHandler()
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and s.eqfilter(chkc,c,e) end
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_SZONE)>0 and not c:IsForbidden()
		and Duel.IsExistingTarget(s.eqfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,c,c,e) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_EQUIP)
	Duel.SelectTarget(tp,s.eqfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,c,c,e)
	Duel.SetOperationInfo(0,CATEGORY_EQUIP,c,1,0,0)
	if c:IsLocation(LOCATION_GRAVE) then Duel.SetOperationInfo(0,CATEGORY_LEAVE_GRAVE,c,1,0,0) end
end
function s.eqop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local tc=Duel.GetFirstTarget()
	if not (c:IsRelateToEffect(e) and tc and tc:IsRelateToEffect(e) and tc:IsFaceup() and tc:IsLocation(LOCATION_MZONE) and not tc:IsImmuneToEffect(e)) then return end
	if Duel.GetLocationCount(tp,LOCATION_SZONE)<=0 or (c:IsLocation(LOCATION_GRAVE) and aux.NecroValleyNegateCheck and aux.NecroValleyNegateCheck(c)) then return end
	s.equip(c,c,tp,tc)
end
--equip ec to tc; it stays equipped only to tc
function s.equip(owner,ec,tp,tc,step)
	if not Duel.Equip(tp,ec,tc,true,step) then return false end
	local e1=Effect.CreateEffect(owner)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(EFFECT_EQUIP_LIMIT)
	e1:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD)
	e1:SetLabelObject(tc)
	e1:SetValue(function(e,c) return c==e:GetLabelObject() end)
	ec:RegisterEffect(e1)
	return true
end
--② unaffected by activated effects of non-"Cursed" cards
function s.immval(e,te)
	return te:IsActivated() and not te:GetHandler():IsSetCard(SET_CURSED)
end
