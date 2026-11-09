--秩序騎士アンクウェル
--Order Knight Unquell (original card)
--②③ have no use limit in the original text: each use detaches 1 material on the field, so they stop when no material is left.
local s,id=GetID()
local SET_ORDER_KNIGHT=0x17c6
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Xyz Summon: 2+ Rank 9 "Order Knight" Xyz Monsters
	Xyz.AddProcedure(c,s.mfilter,nil,2,nil,nil,Xyz.InfiniteMats)
	--① Special Summoned: attach up to 3 cards on the field and/or in the GYs to this card as material
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetTarget(s.mattg)
	e1:SetOperation(s.matop)
	c:RegisterEffect(e1)
	--② your Main Phase: detach 1 material on the field, banish cards on the field up to the number of materials this card has
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_REMOVE)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetRange(LOCATION_MZONE)
	e2:SetTarget(s.rmtg)
	e2:SetOperation(s.rmop)
	c:RegisterEffect(e2)
	--③ the opponent activates a monster effect: detach 1 material on the field, negate that effect
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,2))
	e3:SetCategory(CATEGORY_DISABLE)
	e3:SetType(EFFECT_TYPE_QUICK_O)
	e3:SetCode(EVENT_CHAINING)
	e3:SetProperty(EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL)
	e3:SetRange(LOCATION_MZONE)
	e3:SetCondition(s.negcon)
	e3:SetTarget(s.negtg)
	e3:SetOperation(s.negop)
	c:RegisterEffect(e3)
end
s.listed_series={SET_ORDER_KNIGHT}
function s.mfilter(c)
	return c:IsType(TYPE_XYZ) and c:IsRank(9) and c:IsSetCard(SET_ORDER_KNIGHT)
end
function s.matfilter(c)
	return not c:IsType(TYPE_TOKEN)
end
function s.mattg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsType(TYPE_XYZ)
		and Duel.IsExistingMatchingCard(s.matfilter,tp,LOCATION_ONFIELD+LOCATION_GRAVE,LOCATION_ONFIELD+LOCATION_GRAVE,1,c) end
end
function s.matop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if not (c:IsRelateToEffect(e) and c:IsFaceup()) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_XMATERIAL)
	local g=Duel.SelectMatchingCard(tp,aux.NecroValleyFilter(s.matfilter),tp,LOCATION_ONFIELD+LOCATION_GRAVE,LOCATION_ONFIELD+LOCATION_GRAVE,1,3,c)
	if #g==0 then return end
	Duel.HintSelection(g)
	for tc in aux.Next(g) do
		local og=tc:GetOverlayGroup()
		if #og>0 then Duel.SendtoGrave(og,REASON_RULE) end
	end
	Duel.Overlay(c,g)
end
--after detaching 1, this card must still have a material to count (2+ of its own, or 1 and another on the field)
function s.rmtg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	local ct=c:GetOverlayCount()
	if chk==0 then return Duel.CheckRemoveOverlayCard(tp,1,1,1,REASON_EFFECT)
		and (ct>=2 or ct==1 and Duel.GetOverlayCount(tp,1,1)>ct)
		and Duel.IsExistingMatchingCard(Card.IsAbleToRemove,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_REMOVE,nil,1,PLAYER_ALL,LOCATION_ONFIELD)
end
--with only 1 material left on this card, detach from another Xyz Monster so this card keeps a material to count
function s.otherxyz(c,ec)
	return c~=ec and c:GetOverlayCount()>0
end
function s.rmop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsRelateToEffect(e) and c:GetOverlayCount()==1 then
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVEXYZ)
		local xc=Duel.SelectMatchingCard(tp,s.otherxyz,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,nil,c):GetFirst()
		if not xc or xc:RemoveOverlayCard(tp,1,1,REASON_EFFECT)==0 then return end
	elseif Duel.RemoveOverlayCard(tp,1,1,1,1,REASON_EFFECT)==0 then return end
	if not c:IsRelateToEffect(e) then return end
	local ct=c:GetOverlayCount()
	if ct==0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local g=Duel.SelectMatchingCard(tp,Card.IsAbleToRemove,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,ct,nil)
	if #g>0 then
		Duel.HintSelection(g)
		Duel.Remove(g,POS_FACEUP,REASON_EFFECT)
	end
end
function s.negcon(e,tp,eg,ep,ev,re,r,rp)
	return rp==1-tp and re:IsActiveType(TYPE_MONSTER) and Duel.IsChainDisablable(ev)
		and not e:GetHandler():IsStatus(STATUS_BATTLE_DESTROYED)
end
function s.negtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.CheckRemoveOverlayCard(tp,1,1,1,REASON_EFFECT) end
	Duel.SetOperationInfo(0,CATEGORY_DISABLE,eg,1,0,0)
end
function s.negop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.RemoveOverlayCard(tp,1,1,1,1,REASON_EFFECT)>0 then Duel.NegateEffect(ev) end
end
